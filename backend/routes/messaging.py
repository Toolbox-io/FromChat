from datetime import datetime
import logging
from pathlib import Path
import os
import re
import uuid
from typing import Iterable
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dependencies import get_current_user, get_db
from constants import OWNER_USERNAME
from models import Message, SendMessageRequest, EditMessageRequest, User, DMEnvelope, MessageFile
from push_service import push_service
from PIL import Image
import io
import json

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

MAX_TOTAL_SIZE = 4 * 1024 * 1024 * 1024  # 4 GB

FILES_BASE_DIR = Path("data/uploads/files")
FILES_NORMAL_DIR = FILES_BASE_DIR / "normal"
FILES_ENCRYPTED_DIR = FILES_BASE_DIR / "encrypted"

os.makedirs(FILES_NORMAL_DIR, exist_ok=True)
os.makedirs(FILES_ENCRYPTED_DIR, exist_ok=True)


def convert_message(msg: Message) -> dict:
    return {
        "id": msg.id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "is_read": msg.is_read,
        "is_edited": msg.is_edited,
        "username": msg.author.username,
        "profile_picture": msg.author.profile_picture,
        "reply_to": convert_message(msg.reply_to) if msg.reply_to else None,
        "files": [
            {
                "path": f"/api/files/{'encrypted' if f.encrypted else 'normal'}/{Path(f.path).name}",
                "encrypted": f.encrypted,
                "filename": f.filename,
                "content_type": f.content_type,
                "size": f.size,
            }
            for f in (msg.files or [])
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
            content = obj.get("data", {}).get("content", "")
            reply_to_id = obj.get("reply_to_id", None)
            request = SendMessageRequest(content=content, reply_to_id=reply_to_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload JSON")

    if request.reply_to_id:
        # Check if the message being replied to exists
        original_message = db.query(Message).filter(Message.id == request.reply_to_id).first()
        if not original_message:
            raise HTTPException(status_code=404, detail="Original message not found")

    if not request.content.strip():
        raise HTTPException(
            status_code=400,
            detail="No content provided"
        )

    if len(request.content.strip()) > 4096:
        raise HTTPException(
            status_code=400,
            detail="Message too long"
        )

    new_message = Message(
        content=request.content.strip(),
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
                path=str(out_path),
                encrypted=False,
                filename=original_name,
                content_type=up.content_type,
                size=len(content),
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
        from .messaging import messagingManager  # self import safe here
        await messagingManager.broadcast({
            "type": "newMessage",
            "data": convert_message(new_message)
        })
    except Exception:
        pass

    return {"status": "success", "message": convert_message(new_message)}


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
    import json
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
    )
    db.add(env)
    db.commit()
    db.refresh(env)

    # Save encrypted files if any (no processing)
    if files:
        # Validate total size
        total_size = 0
        for up in files:
            if hasattr(up, "size") and up.size is not None:
                total_size += int(up.size)
            else:
                data = await up.read()
                up.file.seek(0)
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

        for idx, up in enumerate(files):
            provided = names[idx] if idx < len(names) else None
            # Sanitize provided name to avoid path traversal
            if provided and not re.match(r"^[A-Za-z0-9._-]{1,200}$", provided):
                provided = None
            original_name = provided or Path(up.filename or "file").name
            # Save using provided/original name to allow client to reference path directly
            safe_name = original_name
            out_path = FILES_ENCRYPTED_DIR / safe_name

            content = await up.read()
            with open(out_path, "wb") as f:
                f.write(content)

            # We do not store linkage to public messages for DMs; paths will be referenced inside encrypted JSON

    # Send push notification for DM
    try:
        await push_service.send_dm_notification(db, env, current_user)
    except Exception as e:
        logger.error(f"Failed to send push notification for DM {env.id}: {e}")

    # Realtime notify both users for HTTP requests
    try:
        from .messaging import messagingManager  # self import
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
            }
        }
        await messagingManager.send_to_user(env.recipient_id, payload_ws)
        await messagingManager.send_to_user(env.sender_id, payload_ws)
    except Exception:
        pass

    return {"status": "ok", "id": env.id}


@router.get("/dm/fetch")
async def dm_fetch(since: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(DMEnvelope).filter(DMEnvelope.recipient_id == current_user.id)
    if since:
        q = q.filter(DMEnvelope.id > since)
    envs = q.order_by(DMEnvelope.id.asc()).all()
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
            }
            for e in envs
        ]
    }


@router.get("/dm/history/{other_user_id}")
async def dm_history(other_user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    envs = (
        db.query(DMEnvelope)
        .filter(
            ((DMEnvelope.sender_id == current_user.id) & (DMEnvelope.recipient_id == other_user_id))
            | ((DMEnvelope.sender_id == other_user_id) & (DMEnvelope.recipient_id == current_user.id))
        )
        .order_by(DMEnvelope.id.asc())
        .all()
    )
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
            }
            for e in envs
        ]
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
    
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    message.content = request.content.strip()
    message.is_edited = True
    
    db.commit()
    db.refresh(message)
    
    return {"status": "success", "message": convert_message(message)}


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
    
    db.delete(message)
    db.commit()
    
    return {"status": "success", "message_id": message_id}

class MessaggingSocketManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
        self.user_by_ws: dict[WebSocket, int] = {}

    async def send_error(self, websocket: WebSocket, type: str, e: HTTPException):
        await websocket.send_json({"type": type, "error": {"code": e.status_code, "detail": e.detail}})

    async def handle_connection(self, websocket: WebSocket, db: Session):
        while True:
            data = await websocket.receive_json()
            type = data["type"]

            def get_current_user_inner() -> User | None:
                if data["credentials"]:
                    return get_current_user(
                        HTTPAuthorizationCredentials(
                            scheme=data["credentials"]["scheme"], 
                            credentials=data["credentials"]["credentials"]
                        ), 
                        db
                    )
                else:
                    return None

            if type == "ping":
                try:
                    current_user = get_current_user_inner()
                    if current_user:
                        self.user_by_ws[websocket] = current_user.id
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
                await websocket.send_json({"type": "ping", "data": {"status": "success"}})
            elif type == "getMessages":
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    self.user_by_ws[websocket] = current_user.id

                    await websocket.send_json({"type": type, "data": await get_messages(current_user, db)})
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            elif type == "sendMessage":
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
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            elif type == "dmSend":
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
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            elif type == "editMessage":
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
                except HTTPException as e:
                    await self.send_error(websocket, type, e)
            elif type == "deleteMessage":
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
        self.connections.append(websocket)
        try:
            await self.handle_connection(websocket, db)
        except WebSocketDisconnect as e:
            logger.info(f"WebSocket disconnected with code {e.code}: {e.reason}")
        finally:
            self.connections.remove(websocket)
            if websocket in self.user_by_ws:
                del self.user_by_ws[websocket]

    async def broadcast(self, message: dict):
        for websocket in self.connections:
            await websocket.send_json(message)

    async def send_to_user(self, user_id: int, message: dict):
        for websocket in self.connections:
            if self.user_by_ws.get(websocket) == user_id:
                await websocket.send_json(message)

messagingManager = MessaggingSocketManager()

@router.websocket("/chat/ws")
async def chat_websocket(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    await messagingManager.connect(websocket, db)


# File serving endpoints
@router.get("/files/normal/{filename}")
async def get_file_normal(filename: str):
    if not re.match(r"^[A-Za-z0-9._-]+$", filename):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = FILES_NORMAL_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))


@router.get("/files/encrypted/{filename}")
async def get_file_encrypted(filename: str):
    if not re.match(r"^[A-Za-z0-9._-]+$", filename):
        raise HTTPException(status_code=400, detail="Invalid file name")
    path = FILES_ENCRYPTED_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(path))