import secrets
import string
import hashlib
import hmac
import base64
import json
from datetime import datetime, timedelta
from typing import Optional
import re
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import nacl.secret
import nacl.utils
from fastapi import Request
import jwt
import bcrypt
from backend.shared.constants import JWT_SECRET_KEY, JWT_ALGORITHM, MAX_TOKEN_LIFETIME_HOURS
import ipaddress

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def hash_password(password: str, salt: Optional[bytes] = None) -> tuple[str, bytes]:
    """Hash a password with PBKDF2 and return (hash, salt)."""
    if salt is None:
        salt = secrets.token_bytes(32)

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )

    key = kdf.derive(password.encode())
    return base64.b64encode(key).decode(), salt

def verify_password(password: str, hashed: str, salt: bytes) -> bool:
    """Verify a password against its hash and salt."""
    try:
        key = base64.b64decode(hashed)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        kdf.verify(password.encode(), key)
        return True
    except:
        return False

def generate_verification_token() -> str:
    """Generate a verification token for email verification."""
    return generate_secure_token(64)

def generate_reset_token() -> str:
    """Generate a password reset token."""
    return generate_secure_token(64)

def get_client_ip(request: Request) -> str:
    """Extract the real client IP from the request."""
    # Check X-Forwarded-For header first
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in case of multiple proxies
        client_ip = forwarded_for.split(",")[0].strip()
        try:
            # Validate IP address
            ipaddress.ip_address(client_ip)
            return client_ip
        except ValueError:
            pass

    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        try:
            ipaddress.ip_address(real_ip)
            return real_ip
        except ValueError:
            pass

    # Fallback to request.client.host
    client_host = request.client.host if request.client else "unknown"
    try:
        ipaddress.ip_address(client_host)
        return client_host
    except ValueError:
        return "unknown"

def validate_email(email: str) -> bool:
    """Validate email address format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username: str) -> bool:
    """Validate username format."""
    if not username or len(username) < 3 or len(username) > 50:
        return False

    # Allow alphanumeric, underscore, and hyphen
    pattern = r'^[a-zA-Z0-9_-]+$'
    return re.match(pattern, username) is not None

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal."""
    return re.sub(r'[^\w\.-]', '_', filename)

def generate_file_hash(content: bytes) -> str:
    """Generate SHA256 hash of file content."""
    return hashlib.sha256(content).hexdigest()

def encrypt_data(data: str, key: bytes) -> str:
    """Encrypt data using NaCl secret box."""
    box = nacl.secret.SecretBox(key)
    encrypted = box.encrypt(data.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_data(encrypted_data: str, key: bytes) -> str:
    """Decrypt data using NaCl secret box."""
    box = nacl.secret.SecretBox(key)
    encrypted = base64.b64decode(encrypted_data)
    decrypted = box.decrypt(encrypted)
    return decrypted.decode()

def generate_encryption_key() -> bytes:
    """Generate a new encryption key."""
    return nacl.utils.random(nacl.secret.SecretBox.KEY_SIZE)

def format_datetime(dt: datetime) -> str:
    """Format datetime for API responses."""
    return dt.isoformat()

def parse_datetime(dt_str: str) -> Optional[datetime]:
    """Parse datetime from API requests."""
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        return None

def calculate_age(birth_date: datetime) -> int:
    """Calculate age from birth date."""
    today = datetime.now()
    age = today.year - birth_date.year
    if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
        age -= 1
    return age

def truncate_text(text: str, max_length: int, suffix: str = "...") -> str:
    """Truncate text to max length with suffix."""
    if len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix

def is_valid_url(url: str) -> bool:
    """Validate URL format."""
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return re.match(pattern, url) is not None

def generate_device_id() -> str:
    """Generate a unique device identifier."""
    return generate_secure_token(32)

def normalize_phone_number(phone: str) -> str:
    """Normalize phone number format."""
    # Remove all non-digit characters except +
    normalized = re.sub(r'[^\d+]', '', phone)

    # Ensure it starts with +
    if not normalized.startswith('+'):
        if normalized.startswith('00'):
            normalized = '+' + normalized[2:]
        else:
            normalized = '+' + normalized

    return normalized


def create_token(user_id: int, username: str, session_id: str) -> str:
    # Set a long expiration as safety net (actual expiration based on inactivity)
    expire = datetime.now() + timedelta(hours=MAX_TOKEN_LIFETIME_HOURS)
    payload = {
        "user_id": user_id,
        "username": username,
        "session_id": session_id,
        "exp": int(expire.timestamp())  # JWT exp must be Unix timestamp (int)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _is_admin(user) -> bool:
    return user.id == 1


def convert_user(user) -> dict:
    return {
        "id": user.id,
        "created_at": user.created_at.isoformat(),
        "last_seen": user.last_seen.isoformat(),
        "online": user.online,
        "username": user.username,
        "display_name": user.display_name,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "admin": _is_admin(user),
        "verified": user.verified,
        "suspended": user.suspended or False,
        "suspension_reason": user.suspension_reason,
        "deleted": (user.deleted or user.suspended) or False  # Treat suspended as deleted
    }
