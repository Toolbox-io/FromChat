from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, inspect, text
from sqlalchemy.orm import relationship
from datetime import datetime
from db import engine
from pydantic import BaseModel

Base = declarative_base()


# Модели базы данных
class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    profile_picture = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    messages = relationship("Message", back_populates="author", lazy="select")


class Message(Base):
    __tablename__ = "message"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.now)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    is_read = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("message.id"), nullable=True)
    is_edited = Column(Boolean, default=False)

    author = relationship("User", back_populates="messages")
    reply_to = relationship("Message", remote_side=[id])


class CryptoPublicKey(Base):
    __tablename__ = "crypto_public_key"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, unique=True)
    public_key_b64 = Column(Text, nullable=False)


class CryptoBackup(Base):
    __tablename__ = "crypto_backup"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, unique=True)
    blob_json = Column(Text, nullable=False)


class DMEnvelope(Base):
    __tablename__ = "dm_envelope"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    iv_b64 = Column(Text, nullable=False)
    ciphertext_b64 = Column(Text, nullable=False)
    salt_b64 = Column(Text, nullable=False)
    iv2_b64 = Column(Text, nullable=False)
    wrapped_mk_b64 = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.now)


class PushSubscription(Base):
    __tablename__ = "push_subscription"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh_key = Column(Text, nullable=False)
    auth_key = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# Pydantic модели
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str


class SendMessageRequest(BaseModel):
    content: str
    reply_to_id: int | None


class EditMessageRequest(BaseModel):
    content: str


class DeleteMessageRequest(BaseModel):
    message_id: int


class UpdateBioRequest(BaseModel):
    bio: str


class PushSubscriptionRequest(BaseModel):
    endpoint: str
    keys: dict


class UserProfileResponse(BaseModel):
    id: int
    username: str
    profile_picture: str | None
    bio: str | None
    online: bool
    last_seen: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    content: str
    timestamp: datetime
    is_author: bool
    is_read: bool
    username: str
    profile_picture: str | None

    class Config:
        from_attributes = True


# Создание таблиц
Base.metadata.create_all(bind=engine)