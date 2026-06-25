import asyncio
from datetime import datetime, timedelta
from app.core.database import SessionLocal
from app.models.orders import Order
from app.core.websocket import manager

async def monitor_stuck_orders():
    print("🚀 [Monitor] Stuck order monitor started...")
    while True:
        try:
            db = SessionLocal()
            now = datetime.utcnow()
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
                    order.status = "cancelled"
                    new_status = "cancelled"
                    message_type = "order_cancelled"
                    message = "Order cancelled due to no partner availability."
                    
                elif order.status == "accepted":
                    order.status = "new"
                    order.restaurant_id = None
                    new_status = "new"
                    message = "Order returned to queue. Original partner didn't start preparation."
                    
                elif order.status == "assigned":
                    order.status = "ready"
                    order.rider_id = None
                    new_status = "ready"
                    message = "Order returned to ready queue. Rider did not start delivery."
                    
                # Ensure updated_at is refreshed
                order.updated_at = datetime.utcnow()
                
                db.commit()
                db.refresh(order)
                print(f"🔄 [Monitor] Rolled back order {order.id} from {old_status} to {new_status}")
                
                # Notify stakeholders
                await manager.broadcast_order_update(order.id, {
                    "type": message_type,
                    "order_id": order.id,
                    "status": new_status,
                    "message": message,
                    "delivery_address": order.delivery_address,
                    "amount": order.amount
                })
                
        except Exception as e:
            print(f"⚠️ [Monitor Error]: {e}")
        finally:
            if 'db' in locals():
                db.close()
                
        # Check every 30 seconds
        await asyncio.sleep(30)
