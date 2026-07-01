from sqlalchemy import Column, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.core.database import Base

class MarketplaceUser(Base):
    __tablename__ = "marketplace_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=True) # Added for Authentication/Profile
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True) # Added for Authentication
    role = Column(String, nullable=False) # 'customer', 'rider', 'partner'
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    preferences = Column(String, nullable=True) # JSON string for preferences
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    restaurants = relationship("Restaurant", back_populates="owner")

class Restaurant(Base):
    __tablename__ = "restaurants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_users.id"))
    name = Column(String, nullable=False)
    description = Column(String)
    address = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    image_url = Column(String)
    rating = Column(Float, default=0.0)
    contact_number = Column(String, nullable=True)
    support_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    owner = relationship("MarketplaceUser", back_populates="restaurants")
    menu_items = relationship("MenuItem", back_populates="restaurant")

class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    image_url = Column(String)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    restaurant = relationship("Restaurant", back_populates="menu_items")

class SplitRoom(Base):
    __tablename__ = "split_rooms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_users.id", ondelete="CASCADE"), nullable=False)
    room_code = Column(String, unique=True, nullable=False)
    room_pin = Column(String, nullable=False) # Secure PIN for private rooms
    cart_total = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

class SplitRoomMember(Base):
    __tablename__ = "split_room_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(UUID(as_uuid=True), ForeignKey("split_rooms.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_users.id", ondelete="CASCADE"), nullable=False)
    share_amount = Column(Float, default=0.0)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))