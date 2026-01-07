from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.shared.dependencies import get_current_user, get_db
from backend.shared.models import User, PushSubscriptionRequest
from backend.services.push.files import push_service

router = APIRouter()

class SendPublicNotificationRequest(BaseModel):
    message_id: int
    exclude_user_id: int

@router.post("/subscribe")
async def subscribe_to_push_notifications(
    request: PushSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subscribe user to push notifications"""
    try:
        success = await push_service.subscribe_user(
            db=db,
            user_id=current_user.id,
            endpoint=request.endpoint,
            p256dh_key=request.keys["p256dh"],
            auth_key=request.keys["auth"]
        )
        
        if success:
            return {"status": "success", "message": "Push notifications enabled"}
        else:
            raise HTTPException(status_code=500, detail="Failed to enable push notifications")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/unsubscribe")
async def unsubscribe_from_push_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unsubscribe user from push notifications"""
    try:
        success = await push_service.unsubscribe_user(db=db, user_id=current_user.id)

        if success:
            return {"status": "success", "message": "Push notifications disabled"}
        else:
            raise HTTPException(status_code=500, detail="Failed to disable push notifications")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-public-notification")
async def send_public_message_notification(
    request: SendPublicNotificationRequest,
    db: Session = Depends(get_db)
):
    """Send push notification for public message (called by messaging service)"""
    try:
        # Get the message from database
        from backend.shared.models import Message
        message = db.query(Message).filter(Message.id == request.message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")

        await push_service.send_public_message_notification(db, message, exclude_user_id=request.exclude_user_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
