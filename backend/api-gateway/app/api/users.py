from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.database import get_db
from app.models.marketplace import MarketplaceUser
import uuid

router = APIRouter()

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[str] = None

class UserProfileResponse(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: str
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[str] = None

@router.get("/{user_id}/profile", response_model=UserProfileResponse)
async def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = db.query(MarketplaceUser).filter(MarketplaceUser.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user

@router.put("/{user_id}/profile", response_model=UserProfileResponse)
async def update_user_profile(user_id: str, profile: UserProfileUpdate, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
        
    user = db.query(MarketplaceUser).filter(MarketplaceUser.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if profile.name is not None:
        user.name = profile.name
    if profile.phone is not None:
        user.phone = profile.phone
    if profile.address is not None:
        user.address = profile.address
    if profile.bio is not None:
        user.bio = profile.bio
    if profile.preferences is not None:
        user.preferences = profile.preferences
        
    db.commit()
    db.refresh(user)
    
    return user
