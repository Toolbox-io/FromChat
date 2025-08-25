from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dependencies import get_current_user, get_db
from constants import OWNER_USERNAME
from models import Message, SendMessageRequest, EditMessageRequest, ReplyMessageRequest, User, DMEnvelope

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

def convert_message(msg: Message) -> dict:
    return {
        "id": msg.id,
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "is_read": msg.is_read,
        "is_edited": msg.is_edited,
        "username": msg.author.username,
        "profile_picture": msg.author.profile_picture,
        "reply_to": convert_message(msg.reply_to) if msg.reply_to else None
    }


@router.post("/send_message")
async def send_message(
    request: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        timestamp=datetime.now()
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

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
async def dm_send(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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


@router.post("/reply_message")
async def reply_message(
    request: ReplyMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if the message being replied to exists
    original_message = db.query(Message).filter(Message.id == request.reply_to_id).first()
    if not original_message:
        raise HTTPException(status_code=404, detail="Original message not found")
    
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="No content provided")
    
    new_message = Message(
        content=request.content.strip(),
        user_id=current_user.id,
        timestamp=datetime.now(),
        reply_to_id=request.reply_to_id
    )
    
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    
    return {"status": "success", "message": convert_message(new_message)}


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
                except HTTPException:
                    pass
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

                    response = await send_message(request, current_user, db)
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
                    await self.send_to_user(env.recipient_id, {
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
                    })
                    await websocket.send_json({"type": type, "data": {"status": "ok", "id": env.id}})
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
            elif type == "replyMessage":
                try:
                    current_user = get_current_user_inner()
                    if not current_user:
                        raise HTTPException(401)
                    
                    request: ReplyMessageRequest = ReplyMessageRequest.model_validate(data["data"])
                    response = await reply_message(request, current_user, db)
                    await self.broadcast({
                        "type": "newMessage",
                        "data": response["message"]
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