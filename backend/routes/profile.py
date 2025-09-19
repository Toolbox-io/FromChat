from pathlib import Path
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image
import os
import uuid
import io

from dependencies import get_db, get_current_user
from models import User, UpdateBioRequest, UserProfileResponse
from pydantic import BaseModel

router = APIRouter()

# Request models
class UpdateProfileRequest(BaseModel):
    nickname: str | None = None
    description: str | None = None

# Create uploads directory if it doesn't exist
PROFILE_PICTURES_DIR = Path("data/uploads/pfp")

os.makedirs(PROFILE_PICTURES_DIR, exist_ok=True)

@router.post("/upload-profile-picture")
async def upload_profile_picture(
    profile_picture: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and process a profile picture
    """
    # Validate file type
    if not profile_picture.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Validate file size (max 5MB)
    if profile_picture.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    try:
        # Read and process the image
        image_data = await profile_picture.read()
        
        # Open image with PIL
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to a reasonable size (200x200)
        image.thumbnail((200, 200), Image.Resampling.LANCZOS)
        
        # Generate unique filename
        filename = f"{current_user.id}_{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(PROFILE_PICTURES_DIR, filename)
        
        # Save the processed image
        image.save(filepath, 'JPEG', quality=85)
        
        # Update user's profile picture in database
        profile_picture_url = f"/api/profile-picture/{filename}"
        current_user.profile_picture = profile_picture_url
        db.commit()
        
        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": profile_picture_url
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@router.get("/profile-picture/{filename}")
async def get_profile_picture(filename: str):
    """
    Serve profile picture files
    """

    if not re.match(r"^\d+_[0-9a-z]+\.jpg$", filename):
        raise HTTPException(status_code=400, detail="Invalid file name")

    filepath = os.path.join(PROFILE_PICTURES_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Profile picture not found")
    
    return FileResponse(filepath, media_type="image/jpeg")

@router.get("/user/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's profile information
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "profile_picture": current_user.profile_picture,
        "bio": current_user.bio,
        "online": current_user.online,
        "last_seen": current_user.last_seen,
        "created_at": current_user.created_at
    }

@router.put("/user/profile")
async def update_user_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's profile information
    """
    updated = False
    
    # Update username if provided
    if request.nickname is not None:
        nickname = request.nickname.strip()
        if len(nickname) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters long")
        if len(nickname) > 50:
            raise HTTPException(status_code=400, detail="Username must be 50 characters or less")
        
        # Check if username is already taken by another user
        existing_user = db.query(User).filter(User.username == nickname, User.id != current_user.id).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")
        
        current_user.username = nickname
        updated = True
    
    # Update bio if provided
    if request.description is not None:
        bio = request.description.strip()
        if len(bio) > 500:
            raise HTTPException(status_code=400, detail="Bio must be 500 characters or less")
        
        current_user.bio = bio
        updated = True
    
    if updated:
        db.commit()
        return {
            "message": "Profile updated successfully",
            "username": current_user.username,
            "bio": current_user.bio
        }
    else:
        return {
            "message": "No changes made",
            "username": current_user.username,
            "bio": current_user.bio
        }


@router.put("/user/bio")
async def update_user_bio(
    request: UpdateBioRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's bio
    """
    if len(request.bio) > 500:  # Limit bio to 500 characters
        raise HTTPException(status_code=400, detail="Bio must be 500 characters or less")
    
    current_user.bio = request.bio.strip()
    db.commit()
    
    return {
        "message": "Bio updated successfully",
        "bio": current_user.bio
    }


@router.get("/user/{username}")
async def get_user_by_username(
    username: str,
    db: Session = Depends(get_db)
):
    """
    Get user profile by username
    """
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserProfileResponse(
        id=user.id,
        username=user.username,
        profile_picture=user.profile_picture,
        bio=user.bio,
        online=user.online,
        last_seen=user.last_seen,
        created_at=user.created_at
    )
