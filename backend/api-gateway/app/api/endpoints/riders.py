from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from app.core.websocket import manager
from sqlalchemy.orm import Session
from typing import List
from app.models.orders import Order 
from app.schemas.riders import RiderCreate, RiderResponse
from app.models.riders import Rider
from app.core.database import get_db

router = APIRouter()

@router.post("/", response_model=RiderResponse)
def hire_rider(rider: RiderCreate, db: Session = Depends(get_db)):
    # Check if a rider with this phone number already exists
    existing_rider = db.query(Rider).filter(Rider.phone_number == rider.phone_number).first()
    if existing_rider:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Create the new rider. We will set them to active and 'available' immediately for testing.
    db_rider = Rider(
        name=rider.name,
        phone_number=rider.phone_number,
        is_active=True,
        current_status="available"
    )
    
    db.add(db_rider)
    db.commit()
    db.refresh(db_rider)
    return db_rider

@router.get("/available", response_model=List[RiderResponse])
def get_available_riders(db: Session = Depends(get_db)):
    # Query Supabase for only the riders who are currently available to take orders
    available_riders = db.query(Rider).filter(Rider.current_status == "available").all()
    return available_riders

# THIS IS NEW: The WebSocket Tunnel
@router.websocket("/{rider_id}/ws")
async def rider_websocket_endpoint(websocket: WebSocket, rider_id: str):
    # 1. Connect the rider to the switchboard
    await manager.connect_rider(websocket, rider_id)
    try:
        while True:
            # 2. Keep the line open! 
            # In the future, the rider's app will send GPS pings here every 10 seconds.
            # For now, we just wait and listen.
            data = await websocket.receive_text()
            
    except WebSocketDisconnect:
        # 3. If the connection drops, clean up the switchboard
        manager.disconnect_rider(rider_id)
# Make sure you import the Order model at the top!

@router.get("/{rider_id}/earnings")
def get_rider_earnings(rider_id: str, db: Session = Depends(get_db)):
    # Query Supabase for all completed orders for this rider
    completed_orders = db.query(Order).filter(
        Order.rider_id == rider_id, 
        Order.status.in_(["completed", "delivered"])
    ).all()
    
    total_trips = len(completed_orders)
    
    # 🚨 THE FIX: Actually sum up the money from the database rows!
    total_earnings = sum((order.delivery_fee or 0.0) for order in completed_orders)
    
    return {
        "rider_id": rider_id,
        "completed_trips": total_trips,
        "total_earnings": total_earnings
    }

@router.get("/{rider_id}/metrics")
def get_rider_metrics(rider_id: str):
    """
    Provides real-time stats for the Rider Dashboard.
    (Currently returning mock data to power the UI)
    """
    return {
        "rating": 4.8,
        "acceptanceRate": 92,
        "todayTrips": 5
    }