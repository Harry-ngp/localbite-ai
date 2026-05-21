# app/models/orders.py
from sqlalchemy import Column, String, Float, DateTime
from app.core.database import Base
import uuid
from datetime import datetime

class Order(Base):
    __tablename__ = "orders"

    # We use UUIDs (unique text strings) instead of simple numbers (1, 2, 3) 
    # for security, so people can't guess other users' order numbers.
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    customer_name = Column(String, nullable=False)
    delivery_address = Column(String, nullable=False)
    item_description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending_assignment")
    created_at = Column(DateTime, default=datetime.utcnow)