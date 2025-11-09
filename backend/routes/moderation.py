from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List

from constants import OWNER_USERNAME
from dependencies import get_current_user
from models import User
from security.audit import log_security
from security.profanity import add_to_blocklist, get_blocklist, remove_from_blocklist


class BlocklistUpdateRequest(BaseModel):
    words: List[str] = Field(default_factory=list, min_items=1)


router = APIRouter(prefix="/moderation", tags=["moderation"])


def _ensure_owner(user: User) -> None:
    if user.username != OWNER_USERNAME:
        raise HTTPException(status_code=403, detail="Only owner can perform this action")


@router.get("/blocklist")
def list_blocklist(current_user: User = Depends(get_current_user)):
    _ensure_owner(current_user)
    return {"words": get_blocklist()}


@router.post("/blocklist")
def append_blocklist(
    request: BlocklistUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    _ensure_owner(current_user)
    added, updated = add_to_blocklist(request.words)
    log_security(
        "blocklist_add",
        actor=current_user.username,
        actor_id=current_user.id,
        added=added,
    )
    return {"added": added, "words": updated}


@router.delete("/blocklist")
def delete_from_blocklist(
    request: BlocklistUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    _ensure_owner(current_user)
    removed, updated = remove_from_blocklist(request.words)
    log_security(
        "blocklist_remove",
        actor=current_user.username,
        actor_id=current_user.id,
        removed=removed,
    )
    return {"removed": removed, "words": updated}

