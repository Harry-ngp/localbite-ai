from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import bcrypt
from typing import Optional
from app.core.database import get_db
from app.models.marketplace import MarketplaceUser
import uuid

router = APIRouter()

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str

class UserResponse(BaseModel):
    id: uuid.UUID
    name: Optional[str] = None
    email: str
    role: str

@router.post("/signup", response_model=UserResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(MarketplaceUser).filter(MarketplaceUser.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(request.password.encode('utf-8'), salt).decode('utf-8')
    
    # Create user
    new_user = MarketplaceUser(
        name=request.name,
        email=request.email,
        password_hash=hashed_password,
        role=request.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(id=str(new_user.id), name=str(new_user.name) if new_user.name else None, email=str(new_user.email), role=str(new_user.role))

@router.post("/login", response_model=UserResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(MarketplaceUser).filter(MarketplaceUser.email == request.email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.password_hash or not bcrypt.checkpw(request.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if user.role != request.role:
         raise HTTPException(status_code=401, detail="Invalid role for this account")
         
    return UserResponse(id=str(user.id), name=str(user.name) if user.name else None, email=str(user.email), role=str(user.role))
