from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class OrderBase(BaseModel):
    customer_name: str
    delivery_address: str = Field(..., description="The raw, unstructured address text")
    item_description: str
    amount: float = Field(..., gt=0, description="Order value must be greater than 0")
    volume_units: int = Field(20, description="Space required in delivery bag") # Added
    
class OrderCreate(OrderBase):
    # This is what the user sends to create an order. 
    # It inherits everything from OrderBase.
    pass

class OrderResponse(OrderBase):
    id: str
    status: str
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # THIS IS NEW: It is Optional because a brand new order doesn't have a rider yet
    rider_id: Optional[str] = None 

    class Config:
        from_attributes = True