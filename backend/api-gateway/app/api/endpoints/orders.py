from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.schemas.orders import OrderCreate, OrderResponse
from app.models.orders import Order
from app.core.database import get_db

router = APIRouter()

@router.post("/", response_model=OrderResponse)
def create_new_order(order: OrderCreate, db: Session = Depends(get_db)):
    # 1. Map the incoming Pydantic data to our SQLAlchemy database model
    db_order = Order(
        customer_name=order.customer_name,
        delivery_address=order.delivery_address,
        item_description=order.item_description,
        amount=order.amount
    )
    
    # 2. Add the new record to the current database session
    db.add(db_order)
    
    # 3. Commit the transaction (this permanently saves it to Supabase)
    db.commit()
    
    # 4. Refresh the object to grab the auto-generated ID and timestamp from Supabase
    db.refresh(db_order)
    
    # 5. Return the object (FastAPI automatically converts it back to JSON using OrderResponse)
    return db_order


@router.get("/", response_model=List[OrderResponse])
def get_active_orders(db: Session = Depends(get_db)):
    # Query the database to get all orders
    orders = db.query(Order).all()
    return orders