from fastapi import APIRouter, Depends ,HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.riders import Rider
from app.schemas.orders import OrderCreate, OrderResponse
from app.models.orders import Order
from app.core.database import get_db
# THIS IS NEW: Import the switchboard
from app.core.websocket import manager

router = APIRouter()

@router.post("/", response_model=OrderResponse)
async def create_new_order(order: OrderCreate, db: Session = Depends(get_db)):
    # 1. Save to Supabase (Same as before)
    db_order = Order(
        customer_name=order.customer_name,
        delivery_address=order.delivery_address,
        item_description=order.item_description,
        amount=order.amount,
        volume_units=order.volume_units
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # 2. THE DISPATCH TRIGGER
    # Create the JSON payload we want to send to the rider's phone
    offer_payload = {
        "type": "new_order_offer",
        "order_id": db_order.id,
        "delivery_address": db_order.delivery_address,
        "volume_units": db_order.volume_units,
        "amount": db_order.amount
    }
    
    # 3. Broadcast the offer to every rider currently connected to the grid
    # (In the future, we will use PostGIS to only send this to nearby riders!)
    for rider_id, connection in manager.active_connections.items():
        await connection.send_json(offer_payload)
        
    return db_order

# ... (Keep your existing get_active_orders and assign_order_to_rider below)

@router.put("/{order_id}/assign", response_model=OrderResponse)
def assign_order_to_rider(order_id: str, rider_id: str, db: Session = Depends(get_db)):
    # 1. Look up the Order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # 2. Look up the Rider
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
        
    # 3. Business Logic Check: Is the rider actually available?
    if rider.current_status != "available":
        raise HTTPException(status_code=400, detail="Rider is currently busy or offline")
        
    # 4. The Atomic Transaction: Update both states simultaneously
    order.rider_id = rider.id
    order.status = "assigned"
    rider.current_status = "delivering"
    
    # 5. Commit both changes to Supabase at the exact same time
    db.commit()
    db.refresh(order)
    
    return order

@router.get("/", response_model=List[OrderResponse])
def get_active_orders(db: Session = Depends(get_db)):
    # Query the database to get all orders
    orders = db.query(Order).all()
    return orders