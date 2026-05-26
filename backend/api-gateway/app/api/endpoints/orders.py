from fastapi import APIRouter, Depends ,HTTPException ,BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.models.riders import Rider
from app.schemas.orders import OrderCreate, OrderResponse
from app.models.orders import Order
from app.core.database import get_db, SessionLocal
from app.core.websocket import manager
from app.services.nlp import nlp_engine
from sqlalchemy import text
router = APIRouter()

async def process_order_background(order_id: str, address_text: str, amount: float):
    print(f"⚙️ [Background] Processing AI and GPS for order {order_id}...")
    
    ai_extracted_tags = nlp_engine.extract_landmarks(address_text)
    lat, lon = nlp_engine.get_coordinates(ai_extracted_tags)
    
    if lat and lon:
        db = SessionLocal() 
        try:
            # 1. Save the new coordinates to the order
            db_order = db.query(Order).filter(Order.id == order_id).first()
            if db_order:
                db_order.latitude = lat
                db_order.longitude = lon
                db.commit()
                print(f"✅ [Background] Order {order_id} updated with GPS coordinates.")
            
            # 2. 🌍 THE POSTGIS RADIUS SEARCH (3km = 3000 meters)
            query = text("""
                SELECT id FROM riders 
                WHERE ST_DWithin(
                    location, 
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, 
                    3000
                )
            """)
            
            # Execute the search!
            result = db.execute(query, {"lon": lon, "lat": lat}).fetchall()
            nearby_rider_ids = [str(row[0]) for row in result]
            
            print(f"🎯 PostGIS Found {len(nearby_rider_ids)} riders within a 3km radius!")

            # 3. 🚨 TARGETED WEBSOCKET DISPATCH
            offer_payload = {
                "type": "new_order_offer",
                "order_id": order_id,
                "delivery_address": address_text,
                "amount": amount
            }
            
            # 🚨 THE FIX: Check rider_connections instead of active_connections
            for rider_id in nearby_rider_ids:
                if rider_id in manager.rider_connections:
                    await manager.rider_connections[rider_id].send_json(offer_payload)
                    print(f"📡 Dispatched to nearby rider: {rider_id}")

        except Exception as e:
            print(f"⚠️ [Background DB Error]: {e}")
        finally:
            db.close()

@router.post("/", response_model=OrderResponse)
async def create_new_order(
    order: OrderCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # 1. Save the raw order
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
    
    # 2. Handoff to the Background Task
    background_tasks.add_task(
        process_order_background, 
        order_id=db_order.id, 
        address_text=db_order.delivery_address,
        amount=db_order.amount
    )
        
    # 3. Instantly return a response to the customer!
    return db_order

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