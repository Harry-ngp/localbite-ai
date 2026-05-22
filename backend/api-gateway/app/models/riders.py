from sqlalchemy import Column, String, Boolean, Integer
from app.core.database import Base
import uuid

class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=False)
    current_status = Column(String, default="offline") 
    
    # NEW: Dynamic Capacity Tracking
    # Let's say a standard delivery bag holds 100 "volume units"
    max_volume_capacity = Column(Integer, default=100) 
    current_volume_load = Column(Integer, default=0)