from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Integer
from app.core.database import Base
import uuid
from datetime import datetime, timezone

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    customer_name = Column(String, nullable=False)
    delivery_address = Column(String, nullable=False)
    item_description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    
    # NEW: How much space does this order take up in a bag?
    # e.g., 1 Biryani = 15 units. 1 Pizza = 30 units.
    volume_units = Column(Integer, default=20) 
    
    # NEW: Geospatial tracking for the rider's GPS
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # STATUS UPDATE: It will now flow: pending -> offered -> assigned -> delivered
    status = Column(String, default="pending_assignment")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    rider_id = Column(String, ForeignKey("riders.id"), nullable=True)
    restaurant_id = Column(String, nullable=True)  # NEW: Link to restaurant/partner
    customer_id = Column(String, nullable=True)  # NEW: Link to customer
    delivery_fee = Column(Float, default=0.0)