from fastapi import APIRouter, Depends ,HTTPException ,BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.models.riders import Rider
from app.schemas.orders import OrderCreate, OrderResponse
from app.models.orders import Order
from app.core.database import get_db, SessionLocal
# THIS IS NEW: Import the switchboard
from app.core.websocket import manager
# Add this import at the top with your other imports
from app.services.nlp import nlp_engine
router = APIRouter()


# Notice we removed 'db: Session' from the arguments here
async def process_order_background(order_id: str, address_text: str):
    print(f"⚙️ [Background] Processing AI and GPS for order {order_id}...")
    
    ai_extracted_tags = nlp_engine.extract_landmarks(address_text)
    lat, lon = nlp_engine.get_coordinates(ai_extracted_tags)
    
    if lat and lon:
        # 🔑 OPEN A FRESH DATABASE CONNECTION JUST FOR THIS TASK
        db = SessionLocal() 
        try:
            db_order = db.query(Order).filter(Order.id == order_id).first()
            if db_order:
                db_order.latitude = lat
                db_order.longitude = lon
                db.commit()
                print(f"✅ [Background] Order {order_id} updated with GPS coordinates.")
        except Exception as e:
            print(f"⚠️ [Background DB Error]: {e}")
        finally:
            # Always close the door behind you when you are done!
            db.close()

@router.post("/", response_model=OrderResponse)
async def create_new_order(order: OrderCreate,background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    
    # 1. 🧠 AI Interceptor: Get the text landmarks
    ai_extracted_tags = nlp_engine.extract_landmarks(order.delivery_address)
    print(f"🤖 AI Extracted Landmarks: {ai_extracted_tags}")
    
    # 2. 🌍 Maps Interceptor: Convert text to GPS
    lat, lon = nlp_engine.get_coordinates(ai_extracted_tags)
    if lat and lon:
        print(f"📍 GPS Locked: {lat}, {lon}")

    # 3. Save EVERYTHING to Supabase
    db_order = Order(
        customer_name=order.customer_name,
        delivery_address=order.delivery_address,
        item_description=order.item_description,
        amount=order.amount,
        volume_units=order.volume_units
        # Notice we are leaving lat/lon empty for now!
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # 2. 🧠 Handoff to the Background Task
    # 2. 🧠 Handoff to the Background Task
    background_tasks.add_task(
        process_order_background, 
        order_id=db_order.id, 
        address_text=db_order.delivery_address 
        # REMOVED the 'db=db' line from here!
    )
    
    # 3. Trigger the WebSocket Dispatcher 
    offer_payload = {
        "type": "new_order_offer",
        "order_id": db_order.id,
        "delivery_address": db_order.delivery_address,
        "amount": db_order.amount
    }
    for rider_id, connection in manager.active_connections.items():
        await connection.send_json(offer_payload)
        
    # 4. Instantly return a response to the customer!
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

# ...
