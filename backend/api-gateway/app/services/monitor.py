import asyncio
from datetime import datetime, timedelta, timezone
from app.core.database import SessionLocal
from app.models.orders import Order
from app.core.websocket import manager

async def monitor_stuck_orders():
    print("🚀 [Monitor] Stuck order monitor started...")
    while True:
        db = None
        try:
            db = SessionLocal()
            now = datetime.now(timezone.utc)
            # Threshold: 5 minutes
            threshold = now - timedelta(minutes=5)
            
            # Find orders that are stuck
            stuck_orders = db.query(Order).filter(
                Order.updated_at <= threshold,
                Order.status.in_(["new", "accepted", "assigned"])
            ).all()
            
            for order in stuck_orders:
                old_status = order.status
                new_status = ""
                message_type = "order_rollback"
                message = ""
                
                if order.status == "new":
                    order.status = "cancelled" # type: ignore
                    new_status = "cancelled"
                    message_type = "order_cancelled"
                    message = "Order cancelled due to no partner availability."
                    
                elif order.status == "accepted":
                    order.status = "new" # type: ignore
                    order.restaurant_id = None # type: ignore
                    new_status = "new"
                    message = "Order returned to queue. Original partner didn't start preparation."
                    
                elif order.status == "assigned":
                    order.status = "ready" # type: ignore
                    order.rider_id = None # type: ignore
                    new_status = "ready"
                    message = "Order returned to ready queue. Rider did not start delivery."
                    
                # Ensure updated_at is refreshed
                order.updated_at = datetime.now(timezone.utc) # type: ignore
                
                db.commit()
                db.refresh(order)
                print(f"🔄 [Monitor] Rolled back order {order.id} from {old_status} to {new_status}")
                
                # Notify stakeholders
                await manager.broadcast_order_update(str(order.id), {
                    "type": message_type,
                    "order_id": str(order.id),
                    "status": new_status,
                    "message": message,
                    "delivery_address": str(order.delivery_address),
                    "amount": order.amount # type: ignore
                })
                
        except Exception as e:
            print(f"⚠️ [Monitor Error]: {e}")
        finally:
            if db is not None:
                db.close()
                
        # Check every 30 seconds
        await asyncio.sleep(30)
