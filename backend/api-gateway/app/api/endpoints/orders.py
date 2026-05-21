from fastapi import APIRouter
from app.schemas.orders import OrderCreate, OrderResponse
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/", response_model=OrderResponse)
def create_new_order(order: OrderCreate):
    # In the future, this is where we will save the order to PostgreSQL.
    # For now, we simulate a successful database save by generating an ID and timestamp.
    
    return {
        "order_id": str(uuid.uuid4()),
        "customer_name": order.customer_name,
        "delivery_address": order.delivery_address,
        "item_description": order.item_description,
        "amount": order.amount,
        "status": "pending_assignment",
        "created_at": datetime.now()
    }