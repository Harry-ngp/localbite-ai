# app/models/riders.py
from sqlalchemy import Column, String, Boolean
from app.core.database import Base
import uuid

class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=False)
    current_status = Column(String, default="offline") # Statuses: offline, available, delivering