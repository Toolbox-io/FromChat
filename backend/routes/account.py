from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import uuid
from user_agents import parse as parse_ua
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from constants import OWNER_USERNAME
from dependencies import get_current_user, get_db
from models import LoginRequest, RegisterRequest, ChangePasswordRequest, User, CryptoPublicKey, CryptoBackup, DeviceSession
from utils import create_token, get_password_hash, verify_password
from validation import is_valid_password, is_valid_username, is_valid_display_name

router = APIRouter()

def convert_user(user: User) -> dict:
    return {
        "id": user.id,
        "created_at": user.created_at.isoformat(),
        "last_seen": user.last_seen.isoformat(),
        "online": user.online,
        "username": user.username,
        "display_name": user.display_name,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "admin": user.username == OWNER_USERNAME,
        "verified": user.verified,
        "suspended": user.suspended or False,
        "suspension_reason": user.suspension_reason,
        "deleted": user.deleted or False
    }

@router.get("/check_auth")
def check_auth(current_user: User = Depends(get_current_user)):
    return {
        "authenticated": True,
        "username": current_user.username,
        "admin": current_user.username == OWNER_USERNAME
    }


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db), http: Request = None):
    user = db.query(User).filter(User.username == request.username.strip()).first()

    if not user or not verify_password(request.password.strip(), user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Неверное имя пользователя или пароль"
        )

    # Create device session and embed into JWT
    raw_ua = http.headers.get("user-agent") if http else None
    ua = parse_ua(raw_ua or "")
    session_id = uuid.uuid4().hex

    device = DeviceSession(
        user_id=user.id,
        raw_user_agent=raw_ua,
        device_type=("mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "bot" if ua.is_bot else "desktop"),
        os_name=(ua.os.family or None),
        os_version=(ua.os.version_string or None),
        browser_name=(ua.browser.family or None),
        browser_version=(ua.browser.version_string or None),
        brand=(ua.device.brand or None),
        model=(ua.device.model or None),
        session_id=session_id,
        created_at=datetime.now(),
        last_seen=datetime.now(),
        revoked=False,
    )
    db.add(device)

    user.online = True
    user.last_seen = datetime.now()
    db.commit()

    token = create_token(user.id, user.username, session_id)

    return {
        "status": "success",
        "message": "Login successful",
        "token": token,
        "user": convert_user(user)
    }


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db), http: Request = None):
    username = request.username.strip()
    display_name = request.display_name.strip()
    password = request.password.strip()
    confirm_password = request.confirm_password.strip()

    # Determine if owner already exists
    owner_exists = db.query(User).filter(User.username == OWNER_USERNAME).first() is not None

    # If owner not yet registered, only allow the owner to register
    if not owner_exists and username != OWNER_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Регистрация временно закрыта до регистрации владельца"
        )

    # Validate input
    if not is_valid_username(username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя должно быть от 3 до 20 символов и содержать только английские буквы, цифры, дефисы и подчеркивания"
        )

    if not is_valid_display_name(display_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Отображаемое имя должно быть от 1 до 64 символов и не может быть пустым"
        )

    if not is_valid_password(password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен быть от 5 до 50 символов и не содержать пробелов"
        )

    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароли не совпадают"
        )

    # After owner exists, disallow registering the reserved owner username via public registration
    if owner_exists and username == OWNER_USERNAME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Это имя пользователя зарезервировано"
        )

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Это имя пользователя уже занято"
        )

    hashed_password = get_password_hash(password)
    
    # Set verified=True for the owner (first user to register)
    is_owner = not owner_exists and username == OWNER_USERNAME
    
    new_user = User(
        username=username,
        display_name=display_name,
        password_hash=hashed_password,
        online=True,
        last_seen=datetime.now(),
        verified=is_owner
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create initial device session
    raw_ua = http.headers.get("user-agent") if http else None
    ua = parse_ua(raw_ua or "")
    session_id = uuid.uuid4().hex
    device = DeviceSession(
        user_id=new_user.id,
        raw_user_agent=raw_ua,
        device_type=("mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "bot" if ua.is_bot else "desktop"),
        os_name=(ua.os.family or None),
        os_version=(ua.os.version_string or None),
        browser_name=(ua.browser.family or None),
        browser_version=(ua.browser.version_string or None),
        brand=(ua.device.brand or None),
        model=(ua.device.model or None),
        session_id=session_id,
        created_at=datetime.now(),
        last_seen=datetime.now(),
        revoked=False,
    )
    db.add(device)
    db.commit()

    token = create_token(new_user.id, new_user.username, session_id)

    return {
        "status": "success",
        "message": "Регистрация прошла успешно",
        "token": token,
        "user": convert_user(new_user)
    }

@router.get("/crypto/public-key")
def get_public_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(CryptoPublicKey).filter(CryptoPublicKey.user_id == current_user.id).first()
    return {"publicKey": row.public_key_b64 if row else None}


@router.post("/crypto/public-key")
def set_public_key(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pk = payload.get("publicKey")
    if not pk:
        raise HTTPException(status_code=400, detail="publicKey required")
    row = db.query(CryptoPublicKey).filter(CryptoPublicKey.user_id == current_user.id).first()
    if row:
        row.public_key_b64 = pk
    else:
        row = CryptoPublicKey(user_id=current_user.id, public_key_b64=pk)
        db.add(row)
    db.commit()
    return {"status": "ok"}


@router.get("/crypto/backup")
def get_backup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(CryptoBackup).filter(CryptoBackup.user_id == current_user.id).first()
    return {"blob": row.blob_json if row else None}


@router.post("/crypto/backup")
def set_backup(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    blob = payload.get("blob")
    if not blob:
        raise HTTPException(status_code=400, detail="blob required")
    row = db.query(CryptoBackup).filter(CryptoBackup.user_id == current_user.id).first()
    if row:
        row.blob_json = blob
    else:
        row = CryptoBackup(user_id=current_user.id, blob_json=blob)
        db.add(row)
    db.commit()
    return {"status": "ok"}


@router.delete("/admin/user/{user_id}")
def delete_user_as_owner(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only owner can delete users
    if current_user.username != OWNER_USERNAME:
        raise HTTPException(status_code=403, detail="Only owner can perform this action")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deleting the owner account via API
    if user.username == OWNER_USERNAME:
        raise HTTPException(status_code=400, detail="Cannot delete owner account")

    # Manually delete user's messages to satisfy FK constraints
    from models import Message  # local import to avoid circular
    db.query(Message).filter(Message.user_id == user.id).delete()

    db.delete(user)
    db.commit()

    return {"status": "success", "deleted_user_id": user_id}

@router.get("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.online = False
    current_user.last_seen = datetime.now()
    db.commit()

    return {
        "status": "success",
        "message": "Logged out successfully"
    }


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify current derived password against stored hash
    if not verify_password(request.currentPasswordDerived.strip(), current_user.password_hash):
        raise HTTPException(status_code=401, detail="Текущий пароль неверный")

    # Update password hash to hash of new derived password
    current_user.password_hash = get_password_hash(request.newPasswordDerived.strip())
    db.commit()

    # Optionally revoke all other sessions, keeping the current one
    if request.logoutAllExceptCurrent:
        from utils import verify_token as _verify_token
        payload = _verify_token(credentials.credentials)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        current_session_id = payload.get("session_id")
        db.query(DeviceSession).filter(
            DeviceSession.user_id == current_user.id,
            DeviceSession.session_id != current_session_id,
        ).update({DeviceSession.revoked: True})
        db.commit()

    return {"status": "success"}


@router.get("/users")
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.username.asc()).all()
    return {
        "users": [
            convert_user(u) for u in users if u.id != current_user.id
        ]
    }


@router.get("/crypto/public-key/of/{user_id}")
def get_public_key_of(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(CryptoPublicKey).filter(CryptoPublicKey.user_id == user_id).first()
    return {"publicKey": row.public_key_b64 if row else None}


@router.get("/users/search")
def search_users(q: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        return {"users": []}
    
    # Case-insensitive partial match on username
    users = db.query(User).filter(
        User.username.ilike(f"%{q.strip()}%"),
        User.id != current_user.id  # Exclude current user
    ).order_by(User.username.asc()).limit(20).all()
    
    return {
        "users": [convert_user(u) for u in users]
    }