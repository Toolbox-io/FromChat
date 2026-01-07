from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON, BigInteger, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import json
from pydantic import BaseModel

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "account_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    display_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(255), nullable=True)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    public_key = Column(Text, nullable=True)
    private_key = Column(Text, nullable=True)
    encryption_enabled = Column(Boolean, default=False)
    suspended = Column(Boolean, default=False)
    suspension_reason = Column(Text, nullable=True)
    deleted = Column(Boolean, default=False)

    # Relationships
    messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    message_recipients = relationship("MessageRecipient", back_populates="recipient", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    sender_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default="text")
    encrypted_content = Column(Text, nullable=True)
    signature = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    edited_at = Column(DateTime, nullable=True)
    edited = Column(Boolean, default=False)
    deleted = Column(Boolean, default=False)
    reply_to_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=True)
    thread_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=True)
    is_public = Column(Boolean, default=False)

    # Relationships
    sender = relationship("User", back_populates="messages")
    recipients = relationship("MessageRecipient", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])
    thread = relationship("Message", remote_side=[id], foreign_keys=[thread_id])
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    files = relationship("MessageFile", back_populates="message", cascade="all, delete-orphan")

class MessageRecipient(Base):
    __tablename__ = "message_recipients"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    message_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=False, index=True)
    recipient_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    encrypted_key = Column(Text, nullable=True)

    # Relationships
    message = relationship("Message", back_populates="recipients")
    recipient = relationship("User", back_populates="message_recipients")

class MessageReaction(Base):
    __tablename__ = "message_reactions"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    message_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    reaction = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    message = relationship("Message", back_populates="reactions")

class Device(Base):
    __tablename__ = "devices"
    __table_args__ = {"schema": "device_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    device_id = Column(String(255), unique=True, nullable=False, index=True)
    device_name = Column(String(255), nullable=True)
    device_type = Column(String(50), nullable=True)
    public_key = Column(Text, nullable=True)
    signed_prekey = Column(Text, nullable=True)
    one_time_prekeys = Column(JSON, nullable=True)
    last_active = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="devices")
    push_subscriptions = relationship("PushSubscription", back_populates="device", cascade="all, delete-orphan")

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = {"schema": "push_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    device_id = Column(BigInteger, ForeignKey("device_schema.devices.id"), nullable=True, index=True)
    endpoint = Column(String(500), nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="push_subscriptions")
    device = relationship("Device", back_populates="push_subscriptions")

class WebRTCSession(Base):
    __tablename__ = "webrtc_sessions"
    __table_args__ = {"schema": "webrtc_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    session_id = Column(String(255), unique=True, nullable=False, index=True)
    initiator_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    participant_ids = Column(JSON, nullable=False)
    offer = Column(JSON, nullable=True)
    answer = Column(JSON, nullable=True)
    ice_candidates = Column(JSON, nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ModerationAction(Base):
    __tablename__ = "moderation_actions"
    __table_args__ = {"schema": "moderation_schema"}

    id = Column(BigInteger, primary_key=True, index=True)
    moderator_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    target_user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=True)
    target_message_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=True)
    action_type = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class MessageFile(Base):
    __tablename__ = "message_file"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=False, index=True)
    path = Column(Text, nullable=False)
    name = Column(Text, nullable=False)

    message = relationship("Message", back_populates="files")


class CryptoPublicKey(Base):
    __tablename__ = "crypto_public_key"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, unique=True)
    public_key_b64 = Column(Text, nullable=False)


class CryptoBackup(Base):
    __tablename__ = "crypto_backup"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, unique=True)
    blob_json = Column(Text, nullable=False)


class DMEnvelope(Base):
    __tablename__ = "dm_envelope"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    recipient_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    iv_b64 = Column(Text, nullable=False)
    ciphertext_b64 = Column(Text, nullable=False)
    salt_b64 = Column(Text, nullable=False)
    iv2_b64 = Column(Text, nullable=False)
    wrapped_mk_b64 = Column(Text, nullable=False)
    reply_to_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.now)
    files = relationship("DMFile", back_populates="message", cascade="all, delete-orphan", lazy="select")
    reactions = relationship("DMReaction", cascade="all, delete-orphan", lazy="select")


class DMFile(Base):
    __tablename__ = "dm_file"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messaging_schema.dm_envelope.id"), nullable=False, index=True)
    sender_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    recipient_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    name = Column(Text, nullable=False)
    path = Column(Text, nullable=False)

    message = relationship("DMEnvelope", back_populates="files")


class FcmToken(Base):
    __tablename__ = "fcm_token"
    __table_args__ = {"schema": "push_schema"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    token = Column(Text, nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Reaction(Base):
    __tablename__ = "reaction"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(BigInteger, ForeignKey("messaging_schema.messages.id"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    emoji = Column(String(10), nullable=False)  # Store emoji as string
    timestamp = Column(DateTime, default=datetime.now)

    # Relationships
    user = relationship("User")

    # Ensure unique combination of message, user, and emoji
    __table_args__ = (UniqueConstraint('message_id', 'user_id', 'emoji', name='unique_reaction'),)


class DMReaction(Base):
    __tablename__ = "dm_reaction"
    __table_args__ = {"schema": "messaging_schema"}

    id = Column(Integer, primary_key=True, index=True)
    dm_envelope_id = Column(Integer, ForeignKey("messaging_schema.dm_envelope.id"), nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False)
    emoji = Column(String(10), nullable=False)  # Store emoji as string
    timestamp = Column(DateTime, default=datetime.now)

    # Relationships
    user = relationship("User")
    dm_envelope = relationship("DMEnvelope", overlaps="reactions")

    # Ensure unique combination of dm_envelope, user, and emoji
    __table_args__ = (UniqueConstraint('dm_envelope_id', 'user_id', 'emoji', name='unique_dm_reaction'),)


# Tracks authenticated device sessions per user
class DeviceSession(Base):
    __tablename__ = "device_session"
    __table_args__ = {"schema": "device_schema"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)

    # Raw User-Agent for reference/debugging
    raw_user_agent = Column(Text, nullable=True)

    # Parsed fields
    device_name = Column(String(128), nullable=True)
    device_type = Column(String(32), nullable=True)  # desktop/mobile/tablet/bot/unknown
    os_name = Column(String(64), nullable=True)
    os_version = Column(String(64), nullable=True)
    browser_name = Column(String(64), nullable=True)
    browser_version = Column(String(64), nullable=True)
    brand = Column(String(64), nullable=True)
    model = Column(String(64), nullable=True)

    # Session identity embedded into JWTs
    session_id = Column(String(64), unique=True, nullable=False, index=True)

    # Lifecycle
    created_at = Column(DateTime, default=datetime.now)
    last_seen = Column(DateTime, default=datetime.now)
    revoked = Column(Boolean, default=False)

    # Relationship back to user (optional lazy to avoid heavy loads)
    user = relationship("User", lazy="select")


# Pydantic models
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    confirm_password: str


class ChangePasswordRequest(BaseModel):
    currentPasswordDerived: str
    newPasswordDerived: str
    logoutAllExceptCurrent: bool = False


class SendMessageRequest(BaseModel):
    content: str
    reply_to_id: int | None = None


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
    display_name: str
    profile_picture: str | None
    bio: str | None
    online: bool
    last_seen: datetime | None
    created_at: datetime | None
    verified: bool
    suspended: bool
    suspension_reason: str | None
    deleted: bool

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


class ReactionRequest(BaseModel):
    message_id: int
    emoji: str


class ReactionResponse(BaseModel):
    id: int
    message_id: int
    user_id: int
    emoji: str
    timestamp: datetime
    username: str

    class Config:
        from_attributes = True


class DMReactionRequest(BaseModel):
    dm_envelope_id: int
    emoji: str


class DMReactionResponse(BaseModel):
    id: int
    dm_envelope_id: int
    user_id: int
    emoji: str
    timestamp: datetime
    username: str

    class Config:
        from_attributes = True


class UpdateLog(Base):
    """Stores update sequence numbers and updates for gap detection"""
    __tablename__ = "update_log"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("account_schema.users.id"), nullable=False, index=True)
    sequence = Column(Integer, nullable=False, index=True)
    updates = Column(Text, nullable=False)  # JSON array of updates
    timestamp = Column(DateTime, default=datetime.now, index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "sequence", name="uq_user_sequence"),
    )
