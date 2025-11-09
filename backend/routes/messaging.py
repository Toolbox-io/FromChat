from datetime import datetime
import html
import logging
from pathlib import Path
import os
import re
import uuid
import asyncio
import time
import unicodedata
from collections import defaultdict, deque
from difflib import SequenceMatcher
from types import SimpleNamespace
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dependencies import get_current_user, get_db
from .account import convert_user
from constants import OWNER_USERNAME
from models import Message, SendMessageRequest, EditMessageRequest, User, DMEnvelope, MessageFile, DMFile, Reaction, ReactionRequest, ReactionResponse, DMReaction, DMReactionRequest, DMReactionResponse
from push_service import push_service
from PIL import Image
import io
import json
from better_profanity import profanity as _bp
from security.audit import log_access, log_dm, log_public_chat, log_security
from security.profanity import censor_text

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

MAX_TOTAL_SIZE = 4 * 1024 * 1024 * 1024  # 4 GB

FILES_BASE_DIR = Path("data/uploads/files")
FILES_NORMAL_DIR = FILES_BASE_DIR / "normal"
FILES_ENCRYPTED_DIR = FILES_BASE_DIR / "encrypted"

os.makedirs(FILES_NORMAL_DIR, exist_ok=True)
os.makedirs(FILES_ENCRYPTED_DIR, exist_ok=True)

_SPAM_WINDOW_SECONDS = 45
_SPAM_SIMILARITY_THRESHOLD = 0.88
_SPAM_MESSAGE_LIMIT = 5
_BURST_WINDOW_SECONDS = 30
_BURST_COUNT_THRESHOLD = 20
_SHORT_MESSAGE_LENGTH = 8
_SHORT_MESSAGE_REPEAT_LIMIT = 4

_recent_message_cache: dict[int, deque[tuple[str, str, float]]] = defaultdict(deque)
_message_rate_cache: dict[int, deque[float]] = defaultdict(deque)
_burst_last_logged: dict[int, float] = {}


def _normalize_for_spam(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text or "").casefold()
    # Remove whitespace and punctuation while keeping alphanumerics
    cleaned = re.sub(r"[^0-9a-zа-яё]+", "", normalized, flags=re.IGNORECASE)
    return cleaned


def _monitor_public_message_activity(user: User, content: str, db: Session) -> None:
    now = time.time()

    def suspend(reason: str, event: str, **extra: Any) -> None:
        if user.suspended or user.id == 1:
            return
        user.suspended = True
        user.suspension_reason = reason
        db.commit()
        log_security(
            event,
            severity="warning",
            user_id=user.id,
            username=user.username,
            reason=reason,
            **extra,
        )
        try:
            asyncio.create_task(messagingManager.send_suspension_to_user(user.id, reason))
        except Exception:
            pass

    # Rate tracking for burst detection
    rate_bucket = _message_rate_cache[user.id]
    rate_bucket.append(now)
    while rate_bucket and now - rate_bucket[0] > _BURST_WINDOW_SECONDS:
        rate_bucket.popleft()

    burst_count = len(rate_bucket)
    if burst_count >= _BURST_COUNT_THRESHOLD:
        last_logged = _burst_last_logged.get(user.id)
        if not last_logged or now - last_logged > _BURST_WINDOW_SECONDS:
            log_security(
                "public_message_burst",
                severity="warning",
                user_id=user.id,
                username=user.username,
                count=burst_count,
                window_seconds=_BURST_WINDOW_SECONDS,
            )
            _burst_last_logged[user.id] = now
        suspend(
            "Automatic suspension: excessive message rate",
            "auto_suspension_public_burst",
            count=burst_count,
            window_seconds=_BURST_WINDOW_SECONDS,
        )

    # Similarity-based spam detection
    normalized = _normalize_for_spam(content)
    history = _recent_message_cache[user.id]
    while history and now - history[0][2] > _SPAM_WINDOW_SECONDS:
        history.popleft()

    prior_same = sum(1 for prev_norm, _, _ in history if prev_norm == normalized)
    prior_similar = sum(
        1
        for prev_norm, _, _ in history
        if prev_norm and normalized and prev_norm != normalized and SequenceMatcher(None, normalized, prev_norm).ratio() >= _SPAM_SIMILARITY_THRESHOLD
    )

    history.append((normalized, content, now))

    total_matches = prior_same + prior_similar + 1

    if len(normalized) <= _SHORT_MESSAGE_LENGTH and prior_same + 1 >= _SHORT_MESSAGE_REPEAT_LIMIT:
        suspend(
            "Automatic suspension: repeated short messages",
            "auto_suspension_public_spam",
            occurrences=prior_same + 1,
            window_seconds=_SPAM_WINDOW_SECONDS,
            match_type="short",
        )
        return

    if total_matches >= _SPAM_MESSAGE_LIMIT:
        suspend(
            "Automatic suspension: repeated similar public messages",
            "auto_suspension_public_spam",
            similar_messages=total_matches,
            window_seconds=_SPAM_WINDOW_SECONDS,
            match_type="similar",
        )


def convert_message(msg: Message) -> dict:
    # Group reactions by emoji
    reactions_dict = {}
    if msg.reactions:
        for reaction in msg.reactions:
            emoji = reaction.emoji
            if emoji not in reactions_dict:
                reactions_dict[emoji] = {
                    "emoji": emoji,
                    "count": 0,
                    "users": []
                }
            reactions_dict[emoji]["count"] += 1
            reactions_dict[emoji]["users"].append({
                "id": reaction.user_id,
                "username": reaction.user.display_name
            })

    # Handle deleted users
    if msg.author.deleted:
        username = f"Deleted User #{msg.author.id}"
        profile_picture = None
        verified = False
    else:
        username = msg.author.display_name
        profile_picture = msg.author.profile_picture
        verified = msg.author.verified

    return {
        "id": msg.id,
        "user_id": msg.author.id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "is_read": msg.is_read,
        "is_edited": msg.is_edited,
        "username": username,
        "profile_picture": profile_picture,
        "verified": verified,
        "reply_to": convert_message(msg.reply_to) if msg.reply_to else None,
        "reactions": list(reactions_dict.values()),
        "files": [
            {
                "path": f"/api/uploads/files/normal/{Path(f.path).name}",
                "id": f.id,
                "name": f.name,
                "message_id": f.message_id
            }
            for f in (msg.files or [])
        ]
    }


def convert_dm_envelope(envelope: DMEnvelope) -> dict:
    # Group reactions by emoji
    reactions_dict = {}
    if envelope.reactions:
        for reaction in envelope.reactions:
            emoji = reaction.emoji
            if emoji not in reactions_dict:
                reactions_dict[emoji] = {
                    "emoji": emoji,
                    "count": 0,
                    "users": []
                }
            reactions_dict[emoji]["count"] += 1
            reactions_dict[emoji]["users"].append({
                "id": reaction.user_id,
                "username": reaction.user.display_name
            })

    # Get sender info for verified status
    from models import User
    from dependencies import get_db
    db = next(get_db())
    sender = db.query(User).filter(User.id == envelope.sender_id).first()

    # Handle deleted users
    if sender and sender.deleted:
        sender_verified = False
    else:
        sender_verified = sender.verified if sender else False

    return {
        "id": envelope.id,
        "senderId": envelope.sender_id,
        "recipientId": envelope.recipient_id,
        "iv": envelope.iv_b64,
        "ciphertext": envelope.ciphertext_b64,
        "salt": envelope.salt_b64,
        "iv2": envelope.iv2_b64,
        "wrappedMk": envelope.wrapped_mk_b64,
        "timestamp": envelope.timestamp.isoformat(),
        "verified": sender_verified,
        "reactions": list(reactions_dict.values()),
        "files": [
            {
                "path": f"/api/uploads/files/encrypted/{Path(f.path).name}",
                "id": f.id,
                "name": f.name,
                "dm_envelope_id": f.dm_envelope_id
            }
            for f in (envelope.files or [])
        ]
    }

@router.post("/send_message")
async def send_message(
    request: SendMessageRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    # Optional multipart form support
    payload: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
):
    # If payload is provided, prefer it for multipart requests
    if payload and request is None:
        # Expect JSON: {"type":"text","data":{"content": str}, "reply_to_id": number|null}
        try:
            obj = json.loads(payload)
            content = obj.get("content", "")
            reply_to_id = obj.get("reply_to_id", None)
            request = SendMessageRequest(content=content, reply_to_id=reply_to_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload JSON")

    if request.reply_to_id:
        # Check if the message being replied to exists
        original_message = db.query(Message).filter(Message.id == request.reply_to_id).first()
        if not original_message:
            raise HTTPException(status_code=404, detail="Original message not found")

    raw_content = request.content.strip()

    if not raw_content:
        raise HTTPException(
            status_code=400,
            detail="No content provided"
        )

    # Apply profanity filter before storing
    filtered_content = censor_text(raw_content)
    escaped_content = html.escape(filtered_content, quote=False)

    if len(escaped_content) > 4096:
        raise HTTPException(
            status_code=400,
            detail="Message too long"
        )

    new_message = Message(
        content=escaped_content,
        user_id=current_user.id,
        reply_to_id=request.reply_to_id,
        timestamp=datetime.now()
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    # Handle files if provided (normal, not encrypted)
    if files:
        total_size = 0
        for up in files:
            # Accumulate size if available
            if hasattr(up, "size") and up.size is not None:
                total_size += int(up.size)
            else:
                # If size unknown, read into memory to determine
                data = await up.read()
                up.file.seek(0)
                total_size += len(data)
            if total_size > MAX_TOTAL_SIZE:
                raise HTTPException(status_code=400, detail="Total attachments size exceeds 4GB")

        for up in files:
            # Sanitize filename
            original_name = Path(up.filename or "file").name
            ext = Path(original_name).suffix.lower()
            uid = uuid.uuid4().hex
            safe_name = f"{new_message.id}_{uid}{ext or ''}"
            out_path = FILES_NORMAL_DIR / safe_name

            content = await up.read()
            up.file.seek(0)

            # If image, try lossless optimization
            try:
                if up.content_type and up.content_type.startswith("image/"):
                    image = Image.open(io.BytesIO(content))
                    img_format = image.format or ("PNG" if ext == ".png" else "JPEG")
                    buf = io.BytesIO()
                    save_kwargs = {"optimize": True}
                    if img_format.upper() == "JPEG":
                        # Use quality=95 with optimize to keep high quality (not truly lossless but near)
                        save_kwargs["quality"] = 95
                    image.save(buf, format=img_format, **save_kwargs)
                    buf.seek(0)
                    content = buf.read()
            except Exception:
                # Fallback to original content
                pass

            with open(out_path, "wb") as f:
                f.write(content)

            mf = MessageFile(
                message_id=new_message.id,
                name=original_name,
                path=str(out_path)
            )
            db.add(mf)
        db.commit()
        db.refresh(new_message)

    # Send push notifications for public messages
    try:
        await push_service.send_public_message_notification(db, new_message, exclude_user_id=current_user.id)
    except Exception as e:
        logger.error(f"Failed to send push notification for message {new_message.id}: {e}")

    # Realtime broadcast for HTTP uploads as well
    try:
        await messagingManager.broadcast({
            "type": "newMessage",
            "data": convert_message(new_message)
        })
    except Exception:
        pass

    _monitor_public_message_activity(current_user, filtered_content, db)

    message_payload = convert_message(new_message)
    log_public_chat(
        "message_created",
        message_id=new_message.id,
        user_id=current_user.id,
        username=current_user.username,
        reply_to=new_message.reply_to_id,
        attachments=len(new_message.files or []),
        length=len(new_message.content),
        suspended=current_user.suspended,
        content=new_message.content,
    )

    return {"status": "success", "message": message_payload}


@router.get("/get_messages")
async def get_messages(db: Session = Depends(get_db)):
    messages = db.query(Message).order_by(Message.timestamp.asc()).all()

    messages_data = []
    for msg in messages:
        messages_data.append(convert_message(msg))

    return {
        "status": "success",
        "messages": messages_data
    }


@router.post("/dm/send")
async def dm_send(
    payload: dict | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    # Multipart support
    dm_payload: str | None = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    fileNames: str | None = Form(default=None),  # JSON array of filenames corresponding to files
):
    if dm_payload and payload is None:
        try:
            payload = json.loads(dm_payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid dm_payload JSON")

    if payload is None:
        raise HTTPException(status_code=400, detail="Missing payload")

    required = ["recipientId", "iv", "ciphertext", "salt", "iv2", "wrappedMk"]
    for key in required:
        if key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing {key}")

    env = DMEnvelope(
        sender_id=current_user.id,
        recipient_id=int(payload["recipientId"]),
        iv_b64=payload["iv"],
        ciphertext_b64=payload["ciphertext"],
        salt_b64=payload["salt"],
        iv2_b64=payload["iv2"],
        wrapped_mk_b64=payload["wrappedMk"],
        reply_to_id=payload.get("replyToId") if isinstance(payload.get("replyToId"), int) else None,
    )
    db.add(env)
    db.commit()
    db.refresh(env)

    # Save encrypted files if any (no processing)
    if files:
        # Validate total size
        total_size = 0
        for file in files:
            if hasattr(file, "size") and file.size is not None:
                total_size += int(file.size)
            else:
                data = await file.read()
                file.file.seek(0)
                total_size += len(data)
            if total_size > MAX_TOTAL_SIZE:
                raise HTTPException(status_code=400, detail="Total attachments size exceeds 4GB")

        names: list[str] = []
        if fileNames:
            try:
                decoded = json.loads(fileNames)
                if isinstance(decoded, list):
                    names = [str(x) for x in decoded]
            except Exception:
                names = []

        for i, file in enumerate(files):
            provided = names[i] if i < len(names) else None
            # Sanitize provided name to avoid path traversal
            if provided and not re.match(r"^[A-Za-z0-9._-]{1,200}$", provided):
                provided = None
            original_name = provided or Path(file.filename or "file").name
            # Save using provided/original name to allow client to reference path directly
            safe_name = uid = uuid.uuid4().hex
            out_name = f"{current_user.id}_{env.recipient_id}_{env.id}_{safe_name}"
            out_path = FILES_ENCRYPTED_DIR / out_name

            content = await file.read()
            with open(out_path, "wb") as f:
                f.write(content)

            # Save DM file record
            df = DMFile(
                message_id=env.id,
                sender_id=current_user.id,
                recipient_id=env.recipient_id,
                path=f"/api/uploads/files/encrypted/{out_name}",
                name=original_name
            )
            db.add(df)
        db.commit()
        db.refresh(env)

    # Send push notification for DM
    try:
        await push_service.send_dm_notification(db, env, current_user)
    except Exception as e:
        logger.error(f"Failed to send push notification for DM {env.id}: {e}")

    # Realtime notify both users for HTTP requests
    try:
        payload_ws = {
            "type": "dmNew",
            "data": {
                "id": env.id,
                "senderId": env.sender_id,
                "recipientId": env.recipient_id,
                "iv": env.iv_b64,
                "ciphertext": env.ciphertext_b64,
                "salt": env.salt_b64,
                "iv2": env.iv2_b64,
                "wrappedMk": env.wrapped_mk_b64,
                "timestamp": env.timestamp.isoformat(),
                "replyToId": env.reply_to_id,
            }
        }
        await messagingManager.send_to_user(env.recipient_id, payload_ws)
        await messagingManager.send_to_user(env.sender_id, payload_ws)
    except Exception:
        pass

    log_dm(
        "message_sent",
        dm_envelope_id=env.id,
        sender_id=current_user.id,
        sender_username=current_user.username,
        recipient_id=env.recipient_id,
        attachment_count=len(env.files or []),
        reply_to=env.reply_to_id,
    )

    return {"status": "ok", "id": env.id}

def convert_envelopes(envs: list[DMEnvelope]):
    return {
        "status": "ok",
        "messages": [
            {
                "id": e.id,
                "senderId": e.sender_id,
                "recipientId": e.recipient_id,
                "iv": e.iv_b64,
                "ciphertext": e.ciphertext_b64,
                "salt": e.salt_b64,
                "iv2": e.iv2_b64,
                "wrappedMk": e.wrapped_mk_b64,
                "timestamp": e.timestamp.isoformat(),
                "files": [{"name": file.name, "path": file.path, "id": file.id} for file in e.files]
            }
            for e in envs
        ]
    }

@router.get("/dm/fetch")
async def dm_fetch(since: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(DMEnvelope).filter(DMEnvelope.recipient_id == current_user.id)
    if since:
        q = q.filter(DMEnvelope.id > since)
    return convert_envelopes(q.order_by(DMEnvelope.id.asc()).all())


@router.get("/dm/history/{other_user_id}")
async def dm_history(other_user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return convert_envelopes(
        db.query(DMEnvelope)
        .filter(
            ((DMEnvelope.sender_id == current_user.id) & (DMEnvelope.recipient_id == other_user_id))
            | ((DMEnvelope.sender_id == other_user_id) & (DMEnvelope.recipient_id == current_user.id))
        )
        .order_by(DMEnvelope.id.asc())
        .all()
    )


@router.get("/dm/conversations")
async def get_dm_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get all DM conversations where current user is involved
    conversations_query = db.query(DMEnvelope).filter(
        (DMEnvelope.sender_id == current_user.id) | (DMEnvelope.recipient_id == current_user.id)
    ).order_by(DMEnvelope.timestamp.desc())

    # Group by the "other user" (not current user) and get latest message
    conversations = {}
    for envelope in conversations_query:
        other_user_id = envelope.recipient_id if envelope.sender_id == current_user.id else envelope.sender_id

        if other_user_id not in conversations:
            conversations[other_user_id] = envelope

    # Get user info for each conversation
    result = []
    for other_user_id, latest_message in conversations.items():
        other_user = db.query(User).filter(User.id == other_user_id).first()
        if other_user:
            # Calculate unread count for this conversation
            unread_count = db.query(DMEnvelope).filter(
                DMEnvelope.sender_id == other_user_id,
                DMEnvelope.recipient_id == current_user.id,
                DMEnvelope.id > getattr(latest_message, 'last_read_id', 0)  # This would need to be stored somewhere
            ).count()

            result.append({
                "user": convert_user(other_user),
                "lastMessage": convert_dm_envelope(latest_message),
                "unreadCount": unread_count
            })

    # Sort by latest message timestamp
    result.sort(key=lambda x: x["lastMessage"]["timestamp"], reverse=True)

    return {
        "status": "success",
        "conversations": result
    }


@router.put("/edit_message/{message_id}")
async def edit_message(
    message_id: int,
    request: EditMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    raw_content = request.content.strip()

    if not raw_content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    original_content = message.content
    sanitized_content = censor_text(raw_content)
    escaped_content = html.escape(sanitized_content, quote=False)
    if len(escaped_content) > 4096:
        raise HTTPException(status_code=400, detail="Message too long")

    message.content = escaped_content
    message.is_edited = True

    db.commit()
    db.refresh(message)

    payload = convert_message(message)
    log_public_chat(
        "message_edited",
        message_id=message.id,
        user_id=current_user.id,
        username=current_user.username,
        reply_to=message.reply_to_id,
        content=message.content,
        previous_content=original_content,
    )

    return {"status": "success", "message": payload}


@router.delete("/delete_message/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(Message).filter(Message.id == message_id).first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Allow owner to delete any message
    if current_user.username != OWNER_USERNAME and message.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")

    original_content = message.content
    db.delete(message)
    db.commit()

    log_public_chat(
        "message_deleted",
        message_id=message_id,
        actor_id=current_user.id,
        actor_username=current_user.username,
        original_author_id=message.user_id,
        content=original_content,
    )

    return {"status": "success", "message_id": message_id}


@router.post("/add_reaction")
async def add_reaction(
    request: ReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if message exists
    message = db.query(Message).filter(Message.id == request.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check if reaction already exists
    existing_reaction = db.query(Reaction).filter(
        Reaction.message_id == request.message_id,
        Reaction.user_id == current_user.id,
        Reaction.emoji == request.emoji
    ).first()

    if existing_reaction:
        # Remove existing reaction (toggle off)
        db.delete(existing_reaction)
        action = "removed"
    else:
        # Add new reaction
        new_reaction = Reaction(
            message_id=request.message_id,
            user_id=current_user.id,
            emoji=request.emoji
        )
        db.add(new_reaction)
        action = "added"

    db.commit()

    # Refresh message to get updated reactions
    db.refresh(message)

    message_data = convert_message(message)

    # Broadcast reaction update
    try:
        await messagingManager.broadcast({
            "type": "reactionUpdate",
            "data": {
                "message_id": request.message_id,
                "emoji": request.emoji,
                "action": action,
                "user_id": current_user.id,
                "username": current_user.username,
                "reactions": message_data["reactions"]
            }
        })
    except Exception:
        pass

    log_public_chat(
        "reaction_update",
        message_id=request.message_id,
        user_id=current_user.id,
        username=current_user.username,
        action=action,
        emoji=request.emoji,
    )

    return {"status": "success", "action": action, "reactions": message_data["reactions"]}


@router.post("/dm/add_reaction")
async def add_dm_reaction(
    request: DMReactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if DM envelope exists
    envelope = db.query(DMEnvelope).filter(DMEnvelope.id == request.dm_envelope_id).first()
    if not envelope:
        raise HTTPException(status_code=404, detail="DM envelope not found")

    # Check if user is part of this DM conversation
    if current_user.id not in [envelope.sender_id, envelope.recipient_id]:
        raise HTTPException(status_code=403, detail="Not authorized to react to this message")

    # Check if reaction already exists
    existing_reaction = db.query(DMReaction).filter(
        DMReaction.dm_envelope_id == request.dm_envelope_id,
        DMReaction.user_id == current_user.id,
        DMReaction.emoji == request.emoji
    ).first()

    if existing_reaction:
        # Remove existing reaction (toggle off)
        db.delete(existing_reaction)
        action = "removed"
    else:
        # Add new reaction
        new_reaction = DMReaction(
            dm_envelope_id=request.dm_envelope_id,
            user_id=current_user.id,
            emoji=request.emoji
        )
        db.add(new_reaction)
        action = "added"

    db.commit()

    # Refresh envelope to get updated reactions
    db.refresh(envelope)

    envelope_data = convert_dm_envelope(envelope)

    # Broadcast reaction update to both participants
    try:
        await messagingManager.broadcast({
            "type": "dmReactionUpdate",
            "data": {
                "dm_envelope_id": request.dm_envelope_id,
                "emoji": request.emoji,
                "action": action,
                "user_id": current_user.id,
                "username": current_user.username,
                "reactions": envelope_data["reactions"]
            }
        })
    except Exception:
        pass

    log_dm(
        "reaction_update",
        dm_envelope_id=request.dm_envelope_id,
        user_id=current_user.id,
        username=current_user.username,
        action=action,
        emoji=request.emoji,
    )

    return {"status": "success", "action": action, "reactions": envelope_data["reactions"]}


class MessaggingSocketManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
        self.user_by_ws: dict[WebSocket, int] = {}
        self.online_users: set[int] = set()
        self.typing_users: dict[int, float] = {}  # user_id -> timestamp
        self.dm_typing_users: dict[int, dict[int, float]] = {}  # user_id -> {recipient_id -> timestamp}
        self.ws_subscriptions: dict[WebSocket, set[int]] = {}  # websocket -> set of subscribed user_ids
        self._cleanup_task = None

    async def send_error(self, websocket: WebSocket, type: str, e: HTTPException):
        await websocket.send_json({"type": type, "error": {"code": e.status_code, "detail": e.detail}})

    async def handle_connection(self, websocket: WebSocket, db: Session):
        # Initialize subscriptions for this connection
        self.ws_subscriptions[websocket] = set()

        ws_path = getattr(getattr(websocket, "url", None), "path", None)
        if not ws_path and isinstance(getattr(websocket, "scope", None), dict):
            ws_path = websocket.scope.get("path")
        ws_path = ws_path or "unknown"
        headers = {}
        if isinstance(getattr(websocket, "scope", None), dict):
            headers = {k.decode("latin1"): v.decode("latin1") for k, v in websocket.scope.get("headers", [])}
        xff = headers.get("x-forwarded-for")
        client_ip = xff.split(",")[0].strip() if xff else (websocket.client.host if websocket.client else None)

        def _log_ws(event: str, user: User | None, **extra: Any) -> None:
            log_access(
                "ws_event",
                path=ws_path,
                event=event,
                user=user.username if user else None,
                user_id=user.id if user else None,
                ip=client_ip,
                **extra,
            )

        while True:
            data = await websocket.receive_json()
            type = data["type"]

            def get_current_user_inner() -> User | None:
                if data["credentials"]:
                    dummy_request = SimpleNamespace()
                    dummy_request.state = SimpleNamespace()
                    return get_current_user(
                        dummy_request,
                        HTTPAuthorizationCredentials(
                            scheme=data["credentials"]["scheme"],
                            credentials=data["credentials"]["credentials"]
                        ),
                        db
                    )
                else:
                    return None

            if type == "ping":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if current_user:
                        self.user_by_ws[websocket] = current_user.id
                        # Set user online in DB
                        current_user.online = True
                        current_user.last_seen = datetime.now()
                        db.commit()
                        # Add to online users
                        self.online_users.add(current_user.id)
                        # Broadcast status change
                        await self.broadcast_status_change(current_user.id, True, current_user.last_seen.isoformat())
                    else:
                        await websocket.send_json({
                            "type": "ping",
                            "data": {
                                "status": "error",
                                "error": {
                                    "detail": "Failed to authorize",
                                    "code": 401
                                }
                            }
                        })
                        _log_ws("ping_error", current_user)
                except HTTPException:
                    await websocket.send_json({
                        "type": "ping",
                        "data": {
                            "status": "error",
                            "error": {
                                "detail": "Failed to authorize",
                                "code": 401
                            }
                        }
                    })
                    _log_ws("ping_error", current_user)
                await websocket.send_json({"type": "ping", "data": {"status": "success"}})
                _log_ws("ping", current_user)
            elif type == "getMessages":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    await websocket.send_json({"type": type, "data": await get_messages(current_user, db)})
                    _log_ws("getMessages", current_user)
                except HTTPException as e:
                    _log_ws("getMessages_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "sendMessage":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    request: SendMessageRequest = SendMessageRequest.model_validate(data["data"])

                    response = await send_message(request, current_user, db, None, [])
                    await self.broadcast({
                        "type": "newMessage",
                        "data": response["message"]
                    })

                    await websocket.send_json({"type": type, "data": response})
                    _log_ws("sendMessage", current_user, message_id=response["message"]["id"])
                except HTTPException as e:
                    _log_ws("sendMessage_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "dmSend":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id
                    payload = data["data"]
                    required = ["recipientId", "iv", "ciphertext", "salt", "iv2", "wrappedMk"]
                    for key in required:
                        if key not in payload:
                            raise HTTPException(status_code=400, detail=f"Missing {key}")
                    env = DMEnvelope(
                        sender_id=current_user.id,
                        recipient_id=int(payload["recipientId"]),
                        iv_b64=payload["iv"],
                        ciphertext_b64=payload["ciphertext"],
                        salt_b64=payload["salt"],
                        iv2_b64=payload["iv2"],
                        wrapped_mk_b64=payload["wrappedMk"],
                        reply_to_id=payload.get("replyToId") if isinstance(payload.get("replyToId"), int) else None,
                    )
                    db.add(env)
                    db.commit()
                    db.refresh(env)

                    payload = {
                        "type": "dmNew",
                        "data": {
                            "id": env.id,
                            "senderId": env.sender_id,
                            "recipientId": env.recipient_id,
                            "iv": env.iv_b64,
                            "ciphertext": env.ciphertext_b64,
                            "salt": env.salt_b64,
                            "iv2": env.iv2_b64,
                            "wrappedMk": env.wrapped_mk_b64,
                            "timestamp": env.timestamp.isoformat(),
                            "replyToId": env.reply_to_id,
                        }
                    }

                    # Send push notification for DM
                    try:
                        await push_service.send_dm_notification(db, env, current_user)
                    except Exception as e:
                        logger.error(f"Failed to send push notification for DM {env.id}: {e}")

                    await self.send_to_user(env.recipient_id, payload);
                    await websocket.send_json({"type": type, "data": {"status": "ok", "id": env.id}});
                    await self.send_to_user(env.sender_id, payload);

                    _log_ws("dmSend", current_user, dm_envelope_id=env.id, recipient_id=env.recipient_id)
                    log_dm(
                        "message_sent_ws",
                        dm_envelope_id=env.id,
                        sender_id=current_user.id,
                        sender_username=current_user.username,
                        recipient_id=env.recipient_id,
                        reply_to=env.reply_to_id,
                    )
                except HTTPException as e:
                    _log_ws("dmSend_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "editMessage":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    message_id = data["data"]["message_id"]
                    request: EditMessageRequest = EditMessageRequest.model_validate(data["data"])

                    response = await edit_message(message_id, request, current_user, db)
                    await self.broadcast({
                        "type": "messageEdited",
                        "data": response["message"]
                    })

                    await websocket.send_json({"type": type, "data": response})
                    _log_ws("editMessage", current_user, message_id=message_id)
                except HTTPException as e:
                    _log_ws("editMessage_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "dmEdit":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    payload = data["data"]
                    env_id = int(payload["id"])
                    env: DMEnvelope | None = db.query(DMEnvelope).filter(DMEnvelope.id == env_id).first()
                    if not env:
                        raise HTTPException(status_code=404, detail="DM not found")
                    if env.sender_id != current_user.id:
                        raise HTTPException(status_code=403, detail="You can only edit your own messages")

                    # Replace ciphertext and iv
                    env.iv_b64 = payload["iv"]
                    env.ciphertext_b64 = payload["ciphertext"]
                    env.iv2_b64 = payload["iv2"]
                    env.wrapped_mk_b64 = payload["wrappedMk"]
                    env.salt_b64 = payload["salt"]
                    db.commit()
                    db.refresh(env)

                    payload_ws = {
                        "type": "dmEdited",
                        "data": {
                            "id": env.id,
                            "senderId": env.sender_id,
                            "recipientId": env.recipient_id,
                            "iv": env.iv_b64,
                            "ciphertext": env.ciphertext_b64,
                            "iv2": env.iv2_b64,
                            "wrappedMk": env.wrapped_mk_b64,
                            "salt": env.salt_b64,
                            "timestamp": env.timestamp.isoformat(),
                        }
                    }
                    await self.send_to_user(env.recipient_id, payload_ws)
                    await self.send_to_user(env.sender_id, payload_ws)
                    await websocket.send_json({"type": type, "data": {"status": "ok", "id": env.id}})

                    _log_ws("dmEdit", current_user, dm_envelope_id=env.id)
                    log_dm(
                        "message_edited",
                        dm_envelope_id=env.id,
                        user_id=current_user.id,
                        username=current_user.username,
                    )
                except HTTPException as e:
                    _log_ws("dmEdit_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "dmDelete":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    payload = data["data"]
                    env_id = int(payload["id"])
                    env: DMEnvelope | None = db.query(DMEnvelope).filter(DMEnvelope.id == env_id).first()
                    if not env:
                        raise HTTPException(status_code=404, detail="DM not found")
                    if env.sender_id != current_user.id:
                        raise HTTPException(status_code=403, detail="You can only delete your own messages")

                    db.delete(env)
                    db.commit()

                    payload_ws = {
                        "type": "dmDeleted",
                        "data": {
                            "id": env_id,
                            "senderId": current_user.id,
                            "recipientId": payload.get("recipientId")
                        }
                    }
                    await self.send_to_user(env.recipient_id, payload_ws)
                    await websocket.send_json({"type": type, "data": {"status": "ok", "id": env_id}})
                    await self.send_to_user(env.sender_id, payload_ws)

                    _log_ws("dmDelete", current_user, dm_envelope_id=env_id)
                    log_dm(
                        "message_deleted",
                        dm_envelope_id=env_id,
                        user_id=current_user.id,
                        username=current_user.username,
                        recipient_id=env.recipient_id,
                    )
                except HTTPException as e:
                    _log_ws("dmDelete_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "deleteMessage":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    message_id = data["data"]["message_id"]
                    response = await delete_message(message_id, current_user, db)
                    await self.broadcast({
                        "type": "messageDeleted",
                        "data": {"message_id": message_id}
                    })

                    await websocket.send_json({"type": type, "data": response})
                    _log_ws("deleteMessage", current_user, message_id=message_id)
                except HTTPException as e:
                    _log_ws("deleteMessage_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "addReaction":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    request_data = data["data"]
                    reaction_request = ReactionRequest(
                        message_id=request_data["message_id"],
                        emoji=request_data["emoji"]
                    )

                    response = await add_reaction(reaction_request, current_user, db)

                    # Broadcast reaction update
                    await self.broadcast({
                        "type": "reactionUpdate",
                        "data": {
                            "message_id": request_data["message_id"],
                            "emoji": request_data["emoji"],
                            "action": response["action"],
                            "user_id": current_user.id,
                            "username": current_user.username,
                            "reactions": response["reactions"]
                        }
                    })

                    await websocket.send_json({"type": type, "data": response})
                    _log_ws("addReaction", current_user, message_id=request_data["message_id"], emoji=request_data["emoji"], action=response["action"])
                except HTTPException as e:
                    _log_ws("addReaction_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "addDmReaction":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    request_data = data["data"]
                    reaction_request = DMReactionRequest(
                        dm_envelope_id=request_data["dm_envelope_id"],
                        emoji=request_data["emoji"]
                    )

                    response = await add_dm_reaction(reaction_request, current_user, db)

                    # Broadcast reaction update
                    await self.broadcast({
                        "type": "dmReactionUpdate",
                        "data": {
                            "dm_envelope_id": request_data["dm_envelope_id"],
                            "emoji": request_data["emoji"],
                            "action": response["action"],
                            "user_id": current_user.id,
                            "username": current_user.username,
                            "reactions": response["reactions"]
                        }
                    })

                    await websocket.send_json({"type": type, "data": response})
                    _log_ws("addDmReaction", current_user, dm_envelope_id=request_data["dm_envelope_id"], emoji=request_data["emoji"], action=response["action"])
                except HTTPException as e:
                    _log_ws("addDmReaction_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "call_signaling":
                # Forward WebRTC signaling between peers
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    payload = data.get("data") or {}
                    to_user_id = int(payload.get("toUserId") or 0)
                    if not to_user_id:
                        raise HTTPException(status_code=400, detail="Missing toUserId")

                    # Ensure sender is set by the server
                    payload["fromUserId"] = current_user.id
                    payload["fromUsername"] = current_user.username

                    await self.send_to_user(to_user_id, {
                        "type": "call_signaling",
                        "data": payload
                    })

                    # Optional ack
                    await websocket.send_json({"type": "call_signaling", "data": {"status": "ok"}})
                    _log_ws("call_signaling", current_user, to_user_id=to_user_id)
                except HTTPException as e:
                    _log_ws("call_signaling_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
            elif type == "call_video_toggle":
                # Forward video toggle state between peers
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    payload = data.get("data") or {}
                    to_user_id = int(payload.get("toUserId") or 0)
                    if not to_user_id:
                        raise HTTPException(status_code=400, detail="Missing toUserId")

                    # Ensure sender is set by the server
                    payload["fromUserId"] = current_user.id

                    await self.send_to_user(to_user_id, {
                        "type": "call_signaling",
                        "data": {
                            "type": "call_video_toggle",
                            "fromUserId": current_user.id,
                            "toUserId": to_user_id,
                            "data": {"enabled": payload.get("enabled", False)}
                        }
                    })

                    await websocket.send_json({"type": "call_video_toggle", "data": {"status": "ok"}})
                except HTTPException as e:
                    _log_ws("call_video_toggle_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("call_video_toggle", current_user, to_user_id=to_user_id, enabled=payload.get("enabled", False))
            elif type == "call_screen_share_toggle":
                # Forward screen share toggle state between peers
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    payload = data.get("data") or {}
                    to_user_id = int(payload.get("toUserId") or 0)
                    if not to_user_id:
                        raise HTTPException(status_code=400, detail="Missing toUserId")

                    # Ensure sender is set by the server
                    payload["fromUserId"] = current_user.id

                    await self.send_to_user(to_user_id, {
                        "type": "call_signaling",
                        "data": {
                            "type": "call_screen_share_toggle",
                            "fromUserId": current_user.id,
                            "toUserId": to_user_id,
                            "data": {"enabled": payload.get("enabled", False)}
                        }
                    })

                    await websocket.send_json({"type": "call_screen_share_toggle", "data": {"status": "ok"}})
                except HTTPException as e:
                    _log_ws("call_screen_share_toggle_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("call_screen_share_toggle", current_user, to_user_id=to_user_id, enabled=payload.get("enabled", False))
            elif type == "subscribeStatus":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    user_id_to_subscribe = int(data["data"]["userId"])
                    self.ws_subscriptions[websocket].add(user_id_to_subscribe)

                    # Get current status of the user
                    target_user = db.query(User).filter(User.id == user_id_to_subscribe).first()
                    if target_user:
                        await websocket.send_json({
                            "type": "statusUpdate",
                            "data": {
                                "userId": user_id_to_subscribe,
                                "online": target_user.online,
                                "lastSeen": target_user.last_seen.isoformat() if target_user.last_seen else None
                            }
                        })
                    else:
                        await websocket.send_json({
                            "type": "subscribeStatus",
                            "data": {"status": "error", "error": "User not found"}
                        })
                except HTTPException as e:
                    _log_ws("subscribeStatus_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("subscribeStatus", current_user, target_user_id=user_id_to_subscribe)
            elif type == "unsubscribeStatus":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    user_id_to_unsubscribe = int(data["data"]["userId"])
                    self.ws_subscriptions[websocket].discard(user_id_to_unsubscribe)

                    await websocket.send_json({"type": "unsubscribeStatus", "data": {"status": "ok"}})
                except HTTPException as e:
                    _log_ws("unsubscribeStatus_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("unsubscribeStatus", current_user, target_user_id=user_id_to_unsubscribe)
            elif type == "typing":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    self.typing_users[current_user.id] = time.time()

                    # Broadcast to all connected users
                    await self.broadcast({
                        "type": "typing",
                        "data": {
                            "userId": current_user.id,
                            "username": current_user.username
                        }
                    })

                    await websocket.send_json({"type": "typing", "data": {"status": "ok"}})
                except HTTPException as e:
                    _log_ws("typing_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("typing", current_user)
            elif type == "stopTyping":
                current_user: User | None = None
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    if current_user.id in self.typing_users:
                        del self.typing_users[current_user.id]

                    # Broadcast to all connected users
                    await self.broadcast({
                        "type": "stopTyping",
                        "data": {
                            "userId": current_user.id,
                            "username": current_user.username
                        }
                    })

                    await websocket.send_json({"type": "stopTyping", "data": {"status": "ok"}})
                except HTTPException as e:
                    _log_ws("stopTyping_error", current_user, detail=str(getattr(e, "detail", e)))
                    await self.send_error(websocket, type, e)
                else:
                    _log_ws("stopTyping", current_user)
            elif type == "dmTyping":
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    recipient_id = int(data["data"]["recipientId"])

                    if current_user.id not in self.dm_typing_users:
                        self.dm_typing_users[current_user.id] = {}
                    self.dm_typing_users[current_user.id][recipient_id] = time.time()

                    # Send only to recipient
                    await self.send_to_user(recipient_id, {
                        "type": "dmTyping",
                        "data": {
                            "userId": current_user.id,
                            "username": current_user.username
                        }
                    })

                    await websocket.send_json({"type": "dmTyping", "data": {"status": "ok"}})
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            elif type == "stopDmTyping":
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)

                    recipient_id = int(data["data"]["recipientId"])

                    if current_user.id in self.dm_typing_users and recipient_id in self.dm_typing_users[current_user.id]:
                        del self.dm_typing_users[current_user.id][recipient_id]
                        if not self.dm_typing_users[current_user.id]:
                            del self.dm_typing_users[current_user.id]

                    # Send only to recipient
                    await self.send_to_user(recipient_id, {
                        "type": "stopDmTyping",
                        "data": {
                            "userId": current_user.id,
                            "username": current_user.username
                        }
                    })

                    await websocket.send_json({"type": "stopDmTyping", "data": {"status": "ok"}})
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            else:
                await websocket.send_json({"type": type, "error": {"code": 400, "detail": "Invalid type"}})

    async def disconnect(self, websocket: WebSocket, code: int = 1000, message: str | None = None):
        try:
            await websocket.close(code=code, reason=message)
        finally:
            self.connections.remove(websocket)

    async def connect(self, websocket: WebSocket, db: Session):
        await websocket.accept()
        client_ip = websocket.client.host if websocket.client else None
        log_access(
            "ws_connect",
            path=str(websocket.url.path),
            ip=client_ip,
        )
        self.connections.append(websocket)
        try:
            await self.handle_connection(websocket, db)
        except WebSocketDisconnect as e:
            logger.info(f"WebSocket disconnected with code {e.code}: {e.reason}")
            log_access(
                "ws_disconnect",
                severity="warning" if e.code != 1000 else "info",
                path=str(websocket.url.path),
                ip=client_ip,
                code=e.code,
                reason=e.reason,
            )
        finally:
            # Cleanup connection
            self.connections.remove(websocket)
            if websocket in self.user_by_ws:
                user_id = self.user_by_ws[websocket]
                # Set user offline in DB
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.online = False
                    user.last_seen = datetime.now()
                    db.commit()
                    # Remove from online users
                    self.online_users.discard(user_id)
                    # Broadcast status change
                    await self.broadcast_status_change(user_id, False, user.last_seen.isoformat())
                del self.user_by_ws[websocket]
            # Cleanup subscriptions
            if websocket in self.ws_subscriptions:
                del self.ws_subscriptions[websocket]

    async def broadcast(self, message: dict):
        for websocket in self.connections:
            await websocket.send_json(message)

    async def send_to_user(self, user_id: int, message: dict):
        for websocket in self.connections:
            if self.user_by_ws.get(websocket) == user_id:
                await websocket.send_json(message)

    async def send_suspension_to_user(self, user_id: int, reason: str):
        """Send suspension message to user's WebSocket connections"""
        message = {
            "type": "suspended",
            "data": {
                "reason": reason
            }
        }
        await self.send_to_user(user_id, message)

    async def send_deletion_to_user(self, user_id: int):
        """Send account deletion message to user's WebSocket connections"""
        message = {
            "type": "account_deleted",
            "data": {}
        }
        await self.send_to_user(user_id, message)

    async def broadcast_status_change(self, user_id: int, online: bool, last_seen: str):
        """Broadcast status change to all connections that are subscribed to this user"""
        message = {
            "type": "statusUpdate",
            "data": {
                "userId": user_id,
                "online": online,
                "lastSeen": last_seen
            }
        }

        # Send to all connections that have this user in their subscriptions
        for websocket in self.connections:
            if websocket in self.ws_subscriptions and user_id in self.ws_subscriptions[websocket]:
                await websocket.send_json(message)

    async def cleanup_stale_typing_indicators(self):
        """Periodically cleanup typing indicators that haven't been updated in 3+ seconds"""
        while True:
            try:
                current_time = time.time()
                stale_threshold = 3.0  # 3 seconds

                # Cleanup public chat typing indicators
                stale_public_typing = [
                    user_id for user_id, timestamp in self.typing_users.items()
                    if current_time - timestamp > stale_threshold
                ]

                for user_id in stale_public_typing:
                    del self.typing_users[user_id]
                    # Broadcast stop typing
                    await self.broadcast({
                        "type": "stopTyping",
                        "data": {
                            "userId": user_id,
                            "username": "Unknown"  # We don't have username here, frontend will handle
                        }
                    })

                # Cleanup DM typing indicators
                stale_dm_typing = []
                for user_id, recipients in self.dm_typing_users.items():
                    for recipient_id, timestamp in list(recipients.items()):
                        if current_time - timestamp > stale_threshold:
                            stale_dm_typing.append((user_id, recipient_id))

                for user_id, recipient_id in stale_dm_typing:
                    if user_id in self.dm_typing_users and recipient_id in self.dm_typing_users[user_id]:
                        del self.dm_typing_users[user_id][recipient_id]
                        if not self.dm_typing_users[user_id]:
                            del self.dm_typing_users[user_id]
                        # Send stop typing to recipient
                        await self.send_to_user(recipient_id, {
                            "type": "stopDmTyping",
                            "data": {
                                "userId": user_id,
                                "username": "Unknown"  # We don't have username here, frontend will handle
                            }
                        })

                # Wait 1 second before next cleanup
                await asyncio.sleep(1.0)
            except Exception as e:
                logger.error(f"Error in typing cleanup task: {e}")
                await asyncio.sleep(1.0)

    def start_cleanup_task(self):
        """Start the cleanup task if not already running"""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self.cleanup_stale_typing_indicators())

messagingManager = MessaggingSocketManager()

@router.websocket("/chat/ws")
async def chat_websocket(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    await messagingManager.connect(websocket, db)


# File serving endpoints
@router.get("/uploads/files/normal/{filename}")
async def get_file_normal(filename: str):
    if not re.match(r"^[A-Za-z0-9._-]+$", filename):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = FILES_NORMAL_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


@router.get("/uploads/files/encrypted/{filename}")
async def get_file_encrypted(filename: str, current_user: User = Depends(get_current_user)):
    if not re.match(r"^[A-Za-z0-9._-]+$", filename):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = FILES_ENCRYPTED_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    match = re.match(r"^(\d+)_(\d+)_(\d+)_.*$", path.resolve().name)
    if match:
        sender_id = int(match.group(1))
        recipient_id = int(match.group(2))

        if not current_user.id in [sender_id, recipient_id]:
            raise HTTPException(403)
    else:
        raise HTTPException(500)

    return FileResponse(str(path))