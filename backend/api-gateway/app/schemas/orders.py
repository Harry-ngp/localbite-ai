from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class OrderBase(BaseModel):
    customer_name: str
    delivery_address: str = Field(..., description="The raw, unstructured address text")
    item_description: str
    amount: float = Field(..., gt=0, description="Order value must be greater than 0")

class OrderCreate(OrderBase):
    # This is what the user sends to create an order. 
    # It inherits everything from OrderBase.
    pass

class OrderResponse(OrderBase):
    # This is what the API sends back. 
    # It includes system-generated fields.
    order_id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True