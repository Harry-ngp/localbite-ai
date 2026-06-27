from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.marketplace import SplitRoom, SplitRoomMember, MarketplaceUser
import uuid
import random
import string

router = APIRouter()

class CreateRoomRequest(BaseModel):
    host_id: uuid.UUID
    room_pin: str

class JoinRoomRequest(BaseModel):
    user_id: uuid.UUID
    room_code: str
    room_pin: str

class RoomResponse(BaseModel):
    room_id: uuid.UUID
    room_code: str
    host_id: uuid.UUID
    cart_total: float

@router.post("/create", response_model=RoomResponse)
async def create_room(request: CreateRoomRequest, db: Session = Depends(get_db)):
    # Verify host exists
    host = db.query(MarketplaceUser).filter(MarketplaceUser.id == request.host_id).first()
    if not host:
        raise HTTPException(status_code=404, detail="Host user not found")
        
    # Generate unique 6-character alphanumeric code
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    new_room = SplitRoom(
        host_id=request.host_id,
        room_code=f"LB-{code}",
        room_pin=request.room_pin,
        cart_total=0.0
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    
    # Add host as a member
    member = SplitRoomMember(
        room_id=new_room.id,
        user_id=request.host_id,
        share_amount=0.0
    )
    db.add(member)
    db.commit()
    
    return RoomResponse(
        room_id=new_room.id,
        room_code=new_room.room_code,
        host_id=new_room.host_id,
        cart_total=new_room.cart_total
    )

@router.post("/join")
async def join_room(request: JoinRoomRequest, db: Session = Depends(get_db)):
    room = db.query(SplitRoom).filter(SplitRoom.room_code == request.room_code).first()
    
    if not room or not room.is_active:
        raise HTTPException(status_code=404, detail="Room not found or inactive")
        
    if room.room_pin != request.room_pin:
        raise HTTPException(status_code=403, detail="Invalid PIN")
        
    # Check if already joined
    existing_member = db.query(SplitRoomMember).filter(
        SplitRoomMember.room_id == room.id,
        SplitRoomMember.user_id == request.user_id
    ).first()
    
    if not existing_member:
        member = SplitRoomMember(
            room_id=room.id,
            user_id=request.user_id,
            share_amount=0.0
        )
        db.add(member)
        db.commit()
        
    # Return members
    members = db.query(SplitRoomMember).filter(SplitRoomMember.room_id == room.id).all()
    
    # Simple simulation logic for updating total per user (in a real app, logic would be more complex)
    member_count = len(members)
    per_person = room.cart_total / member_count if member_count > 0 else 0
    
    return {
        "room_code": room.room_code,
        "total_members": member_count,
        "cart_total": room.cart_total,
        "per_person": per_person
    }
