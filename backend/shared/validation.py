from typing import Optional
from pydantic import BaseModel, EmailStr, Field, validator
import re


def is_valid_username(username: str) -> bool:
    if len(username) < 3 or len(username) > 20:
        return False
    # Only allow English letters, numbers, dashes and underscores
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False
    return True


def is_valid_display_name(display_name: str) -> bool:
    if len(display_name) < 1 or len(display_name) > 64:
        return False
    # Check if not blank (only whitespace)
    if not display_name.strip():
        return False
    return True


def is_valid_password(password: str) -> bool:
    if len(password) < 5 or len(password) > 50:
        return False
    if re.search(r'[\s\u180E\u200B-\u200D\u2060\uFEFF]', password):
        return False
    return True

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: Optional[str] = Field(None, max_length=100)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username must be alphanumeric with underscores or hyphens')
        return v

    @validator('password')
    def password_strength(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v

class UserLogin(BaseModel):
    username_or_email: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)

class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=255)

    @validator('avatar_url')
    def validate_avatar_url(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('Avatar URL must be a valid HTTP/HTTPS URL')
        return v

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    content_type: str = Field(default="text", pattern=r'^(text|image|video|audio|file)$')
    reply_to_id: Optional[int] = None
    recipient_ids: list[int] = Field(min_items=1, max_items=100)

class MessageUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=10000)

class DeviceRegister(BaseModel):
    device_id: str = Field(min_length=1, max_length=255)
    device_name: Optional[str] = Field(None, max_length=255)
    device_type: Optional[str] = Field(None, max_length=50)
    public_key: Optional[str] = Field(None, max_length=10000)

class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(max_length=500)
    p256dh: str = Field(max_length=255)
    auth: str = Field(max_length=255)
    device_id: Optional[str] = Field(None, max_length=255)

class WebRTCOffer(BaseModel):
    offer: dict
    participant_ids: list[int] = Field(min_items=1, max_items=10)

class WebRTCAnswer(BaseModel):
    answer: dict
    session_id: str = Field(max_length=255)

class WebRTCIceCandidate(BaseModel):
    candidate: dict
    session_id: str = Field(max_length=255)

class ModerationActionCreate(BaseModel):
    target_user_id: Optional[int] = None
    target_message_id: Optional[int] = None
    action_type: str = Field(pattern=r'^(ban|mute|delete|warn)$')
    reason: Optional[str] = Field(None, max_length=1000)
    duration_hours: Optional[int] = Field(None, gt=0, le=8760)  # Max 1 year

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    token: str = Field(min_length=64, max_length=64)
    new_password: str = Field(..., min_length=8, max_length=128)

    @validator('new_password')
    def password_strength(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v

class TwoFactorSetup(BaseModel):
    code: str = Field(pattern=r'^\d{6}$')

class TwoFactorVerify(BaseModel):
    code: str = Field(pattern=r'^\d{6}$')

class EmailVerification(BaseModel):
    token: str = Field(min_length=64, max_length=64)
