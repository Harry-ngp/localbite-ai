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
import asyncio
router = APIRouter()

async def process_order_background(order_id: str, address_text: str, amount: float, restaurant_id: str = None):
    print(f"⚙️ [Background] Processing order {order_id}...")
    
    db = SessionLocal()
    try:
        # 1. Update order with default GPS (Nagpur center)
        db_order = db.query(Order).filter(Order.id == order_id).first()
        if db_order:
            # Default to Nagpur city center
            db_order.latitude = 21.1458
            db_order.longitude = 79.0882
            db_order.status = "new"
            db.commit()
            print(f"✅ [Background] Order {order_id} saved to database")
        
        # 2. 🚨 NEW: Broadcast to ALL connected riders (no radius filtering!)
        offer_payload = {
            "type": "new_order_offer",
            "order_id": order_id,
            "delivery_address": address_text,
            "amount": amount,
            "restaurant_id": restaurant_id
        }
        
        # Send to ALL online riders
        for rider_id in list(manager.rider_connections.keys()):
            try:
                await manager.rider_connections[rider_id].send_json(offer_payload)
                print(f"📡 Dispatched order {order_id} to rider: {rider_id}")
            except Exception as e:
                print(f"❌ Failed to send to rider {rider_id}: {e}")

    except Exception as e:
        print(f"⚠️ [Background Error]: {e}")
    finally:
        db.close()

@router.post("/", response_model=OrderResponse)
async def create_new_order(
    order: OrderCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # 1. Save the order to database
    db_order = Order(
        customer_name=order.customer_name,
        delivery_address=order.delivery_address,
        item_description=order.item_description,
        amount=order.amount,
        volume_units=order.volume_units,
        restaurant_id=order.restaurant_id,  # NEW: Store restaurant ID
        customer_id=order.customer_id,      # NEW: Store customer ID
        status="new"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    print(f"✅ Order {db_order.id} created successfully")
    
    # 2. 🚨 NEW: Broadcast to all partners through WebSocket
    await manager.broadcast_order_update(db_order.id, {
        "type": "order_placed",
        "order_id": db_order.id,
        "customer_name": order.customer_name,
        "item_description": order.item_description,
        "amount": order.amount,
        "delivery_address": order.delivery_address,
        "restaurant_id": order.restaurant_id,  # NEW: Send restaurant ID
        "status": "new"
    })
    
    # 3. Handoff to background task for rider offers
    background_tasks.add_task(
        process_order_background, 
        order_id=db_order.id, 
        address_text=db_order.delivery_address,
        amount=db_order.amount,
        restaurant_id=order.restaurant_id
    )
        
    # 4. Return response to customer
    return db_order

@router.put("/{order_id}/assign", response_model=OrderResponse)
def assign_order_to_rider(order_id: str, rider_id: str, db: Session = Depends(get_db)):
    # 🚨 SIMPLIFIED: No radius checks, just assign
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.rider_id = rider_id
    order.status = "assigned"
    db.commit()
    db.refresh(order)
    
    print(f"✅ Order {order_id} assigned to rider {rider_id}")
    return order

@router.get("/", response_model=List[OrderResponse])
def get_active_orders(
    db: Session = Depends(get_db),
    customer_id: str = None,
    restaurant_id: str = None
):
    # � FIXED: Return REAL orders from database
    try:
        query = db.query(Order)
        
        if restaurant_id:
            query = query.filter(Order.restaurant_id == restaurant_id)
        if customer_id:
            query = query.filter(Order.customer_id == customer_id)
        
        orders = query.all()
        print(f"📋 Retrieved {len(orders)} orders")
        return orders
    except Exception as e:
        print(f"❌ Error fetching orders: {e}")
        return []

@router.get("/available-for-rider", response_model=List[OrderResponse])
def get_available_orders_for_rider(db: Session = Depends(get_db)):
    """Get all orders with status 'ready' that riders can pick up"""
    try:
        orders = db.query(Order).filter(Order.status == "ready").all()
        print(f"📋 Found {len(orders)} orders available for riders")
        return orders
    except Exception as e:
        print(f"❌ Error fetching available orders: {e}")
        return []

@router.get("/{order_id}/status")
def get_order_status(order_id: str, db: Session = Depends(get_db)):
    """Get current status of a specific order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "id": order.id,
        "status": order.status,
        "rider_id": order.rider_id,
        "restaurant_id": order.restaurant_id,
        "delivery_address": order.delivery_address,
        "item_description": order.item_description,
        "amount": order.amount
    }

@router.put("/{order_id}/assign", response_model=OrderResponse)
def assign_order_to_rider(order_id: str, rider_id: str, db: Session = Depends(get_db)):
    # 🚨 SIMPLIFIED: No radius checks, just assign
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.rider_id = rider_id
    order.status = "assigned"
    db.commit()
    db.refresh(order)
    
    print(f"✅ Order {order_id} assigned to rider {rider_id}")
    return order

@router.put("/{order_id}/complete", response_model=OrderResponse)
def complete_delivery(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    rider = db.query(Rider).filter(Rider.id == order.rider_id).first()
    if rider:
        rider.current_status = "available"
        
    # 🚨 THE FIX: Update the status AND officially log the fee!
    order.status = "completed"
    order.delivery_fee = 40.0 
    
    db.commit()
    db.refresh(order)
    return order

@router.put("/{order_id}/update-status")
async def update_order_status(
    order_id: str, 
    status: str = None,
    message_type: str = None,
    restaurant_name: str = None,
    rider_name: str = None,
    rider_id: str = None,
    db: Session = Depends(get_db)
):
    """
    🚨 NEW: Update order status and broadcast to ALL stakeholders via WebSocket
    Accepts query parameters for status update details
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update the order status in database
    if status:
        order.status = status
        db.commit()
        db.refresh(order)
    
    # 🚨 NEW: Broadcast status update to ALL stakeholders via WebSocket
    try:
        broadcast_payload = {
            "type": message_type or status,
            "order_id": order_id,
            "status": status,
            "timestamp": str(asyncio.get_event_loop().time())
        }
        
        if message_type == "order_accepted" and restaurant_name:
            broadcast_payload["restaurant_name"] = restaurant_name
        elif message_type == "rider_assigned":
            broadcast_payload["rider_name"] = rider_name or rider_id
            broadcast_payload["rider_id"] = rider_id
        
        # Broadcast to ALL connected customers, partners, and riders
        await manager.broadcast_order_update(order_id, broadcast_payload)
        print(f"📡 Broadcast {message_type} update for order {order_id} to all stakeholders")
    except Exception as e:
        print(f"⚠️ Failed to broadcast status update: {e}")
    
    return {"id": order.id, "status": order.status, "message": "Status updated successfully"}

@router.put("/{order_id}/accept")
async def accept_order(order_id: str, restaurant_id: str, db: Session = Depends(get_db)):
    """
    🚨 PARTNER ACCEPTS ORDER: Update status to 'accepted' and broadcast to customer
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = "accepted"
    order.restaurant_id = restaurant_id
    db.commit()
    db.refresh(order)
    
    # Broadcast to customer + riders that order is accepted
    await manager.broadcast_order_update(order_id, {
        "type": "order_accepted",
        "order_id": order_id,
        "status": "accepted",
        "message": "Your order has been accepted! Preparing your food..."
    })
    
    print(f"✅ Order {order_id} accepted by restaurant {restaurant_id}")
    return order

@router.put("/{order_id}/preparing")
async def mark_order_preparing(order_id: str, db: Session = Depends(get_db)):
    """Partner starts preparing the order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = "preparing"
    db.commit()
    db.refresh(order)
    
    await manager.broadcast_order_update(order_id, {
        "type": "order_preparing",
        "order_id": order_id,
        "status": "preparing",
        "message": "👨‍🍳 Your food is being prepared!"
    })
    
    print(f"✅ Order {order_id} is now being prepared")
    return order

@router.put("/{order_id}/ready")
async def mark_order_ready(order_id: str, db: Session = Depends(get_db)):
    """
    🚨 PARTNER MARKS READY: Order is ready for pickup - notify riders
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = "ready"
    db.commit()
    db.refresh(order)
    
    # Broadcast to ALL riders: Hey, this order is ready for pickup!
    await manager.broadcast_order_update(order_id, {
        "type": "order_ready_for_pickup",
        "order_id": order_id,
        "status": "ready",
        "delivery_address": order.delivery_address,
        "amount": order.amount,
        "message": "🎉 Order ready! Looking for rider to pick up..."
    })
    
    # Notify customer that food is ready
    await manager.broadcast_order_update(order_id, {
        "type": "food_ready",
        "order_id": order_id,
        "status": "ready",
        "message": "✅ Your food is ready! Rider will pick up soon."
    })
    
    print(f"✅ Order {order_id} marked as ready for pickup")
    return order

@router.put("/{order_id}/rider/accept")
async def rider_accept_order(order_id: str, rider_id: str, db: Session = Depends(get_db)):
    """
    🚨 RIDER ACCEPTS ORDER: Assign rider and notify everyone
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    
    order.status = "assigned"
    order.rider_id = rider_id
    rider.current_status = "on_delivery"
    
    db.commit()
    db.refresh(order)
    db.refresh(rider)
    
    # Broadcast: Rider accepted - notify customer and partner
    await manager.broadcast_order_update(order_id, {
        "type": "rider_assigned",
        "order_id": order_id,
        "rider_id": rider_id,
        "rider_name": rider.name if hasattr(rider, 'name') else f"Rider {rider_id[:8]}",
        "status": "assigned",
        "message": "🏍️ Rider on the way to pick up your order!"
    })
    
    print(f"✅ Rider {rider_id} accepted order {order_id}")
    return order

@router.put("/{order_id}/rider/reject")
async def rider_reject_order(order_id: str, rider_id: str, db: Session = Depends(get_db)):
    """
    🚨 RIDER REJECTS ORDER: Keep status as 'ready' to offer other riders
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    print(f"❌ Rider {rider_id} rejected order {order_id}")
    
    # Revert to 'ready' so other riders can see it
    order.status = "ready"
    db.commit()
    
    # Re-broadcast to all riders
    await manager.broadcast_order_update(order_id, {
        "type": "order_available",
        "order_id": order_id,
        "status": "ready",
        "delivery_address": order.delivery_address,
        "amount": order.amount,
        "message": "Order available - rider needed!"
    })
    
    return {"message": "Order rejected and re-offered to other riders"}

@router.put("/{order_id}/in-delivery")
async def start_delivery(order_id: str, db: Session = Depends(get_db)):
    """
    🚨 RIDER PICKS UP: Order is in delivery - notify customer with live tracking
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = "in_delivery"
    db.commit()
    db.refresh(order)
    
    # Notify customer: Rider has picked up, en route now
    await manager.broadcast_order_update(order_id, {
        "type": "delivery_started",
        "order_id": order_id,
        "status": "in_delivery",
        "message": "🚗 Your food is on the way! Check live tracking."
    })
    
    print(f"✅ Order {order_id} is now in delivery")
    return order

@router.put("/{order_id}/complete-delivery")
async def complete_delivery_new(order_id: str, db: Session = Depends(get_db)):
    """
    🚨 ORDER DELIVERED: Mark complete and notify for rating
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    rider = db.query(Rider).filter(Rider.id == order.rider_id).first()
    if rider:
        rider.current_status = "available"
        rider.completed_deliveries = getattr(rider, 'completed_deliveries', 0) or 0
        rider.completed_deliveries += 1
    
    order.status = "delivered"
    order.delivery_fee = 40.0
    
    db.commit()
    db.refresh(order)
    
    # Notify customer: Order delivered, please rate
    await manager.broadcast_order_update(order_id, {
        "type": "delivery_complete",
        "order_id": order_id,
        "status": "delivered",
        "message": "✅ Order delivered! Please rate your experience."
    })
    
    print(f"✅ Order {order_id} delivery completed")
    return order