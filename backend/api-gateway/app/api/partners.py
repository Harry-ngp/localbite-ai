from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.models.marketplace import MarketplaceUser, Restaurant, MenuItem
from app.models.orders import Order
import uuid
from app.services.ai_service import generate_combos

router = APIRouter()

# --- Pydantic Schemas ---
class LoginRequest(BaseModel):
    email: str

class RestaurantCreate(BaseModel):
    name: str
    description: str
    address: str
    latitude: float
    longitude: float
    image_url: str

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    contact_number: Optional[str] = None
    support_number: Optional[str] = None
    is_open: Optional[bool] = None

class MenuItemCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    image_url: str
    in_stock: Optional[bool] = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None

# --- Endpoints ---
@router.post("/login")
def partner_login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(MarketplaceUser).filter(
        MarketplaceUser.email == req.email.strip().lower(),
        MarketplaceUser.role == 'partner'
    ).first()
    if not user:
        user = MarketplaceUser(email=req.email.strip().lower(), role='partner')
        db.add(user)
        db.commit()
        db.refresh(user)
    
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == user.id).first()
    
    return {
        "partner_id": str(user.id),
        "restaurant": {
            "id": str(restaurant.id),
            "name": restaurant.name,
            "description": restaurant.description,
            "address": restaurant.address,
            "image_url": restaurant.image_url,
            "rating": restaurant.rating,
            "is_open": restaurant.is_open if restaurant.is_open is not None else True,
            "latitude": restaurant.latitude,
            "longitude": restaurant.longitude,
            "contact_number": restaurant.contact_number,
            "support_number": restaurant.support_number,
        } if restaurant else None
    }

@router.post("/{partner_id}/restaurant")
def create_restaurant(partner_id: str, req: RestaurantCreate, db: Session = Depends(get_db)):
    new_rest = Restaurant(
        owner_id=uuid.UUID(partner_id),
        name=req.name,
        description=req.description,
        address=req.address,
        latitude=req.latitude,
        longitude=req.longitude,
        image_url=req.image_url
    )
    db.add(new_rest)
    db.commit()
    db.refresh(new_rest)
    return {
        "id": str(new_rest.id),
        "name": new_rest.name,
        "description": new_rest.description,
        "address": new_rest.address,
        "image_url": new_rest.image_url,
        "rating": new_rest.rating,
    }

@router.put("/{partner_id}/restaurant/{restaurant_id}")
def update_restaurant(partner_id: str, restaurant_id: str, req: RestaurantUpdate, db: Session = Depends(get_db)):
    """Update restaurant profile details"""
    rest = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if req.name is not None: rest.name = req.name  # type: ignore[assignment]
    if req.description is not None: rest.description = req.description  # type: ignore[assignment]
    if req.address is not None: rest.address = req.address  # type: ignore[assignment]
    if req.image_url is not None: rest.image_url = req.image_url  # type: ignore[assignment]
    if req.contact_number is not None: rest.contact_number = req.contact_number  # type: ignore[assignment]
    if req.support_number is not None: rest.support_number = req.support_number  # type: ignore[assignment]
    if req.is_open is not None: rest.is_open = req.is_open  # type: ignore[assignment]
    db.commit()
    db.refresh(rest)
    return {
        "id": str(rest.id),
        "name": rest.name,
        "description": rest.description,
        "address": rest.address,
        "contact_number": rest.contact_number,
        "support_number": rest.support_number,
        "is_open": rest.is_open,
    }

@router.post("/restaurant/{restaurant_id}/menu")
def add_menu_item(restaurant_id: str, req: MenuItemCreate, db: Session = Depends(get_db)):
    new_item = MenuItem(
        restaurant_id=uuid.UUID(restaurant_id),
        name=req.name,
        description=req.description,
        price=req.price,
        category=req.category,
        image_url=req.image_url,
        is_available=req.in_stock if req.in_stock is not None else True
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {
        "id": str(new_item.id),
        "name": new_item.name,
        "price": new_item.price,
        "category": new_item.category,
        "image_url": new_item.image_url,
        "is_available": new_item.is_available,
        "in_stock": new_item.is_available,
    }

@router.get("/restaurant/{restaurant_id}/menu")
def get_menu(restaurant_id: str, db: Session = Depends(get_db)):
    items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
    return [
        {
            "id": str(item.id),
            "name": item.name,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "image_url": item.image_url,
            "is_available": item.is_available,
            "in_stock": item.is_available,
        }
        for item in items
    ]

@router.put("/restaurant/{restaurant_id}/menu/{item_id}")
def update_menu_item(restaurant_id: str, item_id: str, req: MenuItemUpdate, db: Session = Depends(get_db)):
    """Update menu item details or stock status"""
    item = db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    if req.name is not None: item.name = req.name  # type: ignore[assignment]
    if req.price is not None: item.price = req.price  # type: ignore[assignment]
    if req.category is not None: item.category = req.category  # type: ignore[assignment]
    if req.image_url is not None: item.image_url = req.image_url  # type: ignore[assignment]
    if req.is_available is not None: item.is_available = req.is_available  # type: ignore[assignment]
    db.commit()
    db.refresh(item)
    return {"id": str(item.id), "name": item.name, "is_available": item.is_available}

@router.delete("/restaurant/{restaurant_id}/menu/{item_id}")
def delete_menu_item(restaurant_id: str, item_id: str, db: Session = Depends(get_db)):
    """Delete a menu item"""
    item = db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    db.delete(item)
    db.commit()
    return {"status": "deleted", "item_id": item_id}

@router.get("/restaurant/{restaurant_id}/orders")
def get_restaurant_orders(restaurant_id: str, db: Session = Depends(get_db)):
    """Get all orders for a restaurant with full details"""
    try:
        orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).order_by(Order.created_at.desc()).all()
        print(f"📋 Retrieved {len(orders)} orders for restaurant {restaurant_id}")
        return [
            {
                "id": o.id,
                "status": o.status,
                "item_description": o.item_description,
                "amount": o.amount,
                "delivery_address": o.delivery_address,
                "customer_id": o.customer_id,
                "rider_id": o.rider_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "time": o.created_at.strftime("%I:%M %p") if o.created_at else "Recently",
                "restaurant_name": None,  # Partner knows their own name
            }
            for o in orders
        ]
    except Exception as e:
        print(f"❌ Error fetching restaurant orders: {e}")
        return []

@router.get("/restaurant/{restaurant_id}/analytics")
def get_restaurant_analytics(restaurant_id: str, db: Session = Depends(get_db)):
    """Real analytics computed from the orders table"""
    try:
        all_orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).all()
        
        completed = [o for o in all_orders if o.status in ("delivered", "completed")]
        active    = [o for o in all_orders if o.status in ("new", "accepted", "preparing")]
        ready     = [o for o in all_orders if o.status == "ready"]
        
        # Real revenue = sum of amounts for completed orders
        total_revenue = sum(o.amount or 0 for o in completed)
        
        # Weekly revenue: group completed orders by day of week
        from datetime import datetime, timedelta, timezone
        today = datetime.now(timezone.utc).date()
        week_start = today - timedelta(days=today.weekday())  # Monday
        
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekly = {d: 0.0 for d in day_names}
        for o in completed:
            if o.created_at and o.created_at.date() >= week_start:
                day_idx = o.created_at.weekday()
                weekly[day_names[day_idx]] += (o.amount or 0)
        
        weekly_data = [{"day": d, "revenue": round(weekly[d], 2)} for d in day_names]
        
        # Avg order value
        avg_order = round(total_revenue / len(completed), 2) if completed else 0
        
        return {
            "revenue": round(total_revenue, 2),
            "ordersCount": len(all_orders),
            "completedToday": len(completed),
            "activeOrders": len(active),
            "readyOrders": len(ready),
            "avgRating": 4.5,  # Will be real once we store ratings
            "avgOrderValue": avg_order,
            "weeklyRevenue": weekly_data,
        }
    except Exception as e:
        print(f"❌ Analytics error: {e}")
        return {
            "revenue": 0, "ordersCount": 0, "completedToday": 0,
            "activeOrders": 0, "readyOrders": 0, "avgRating": 4.0,
            "avgOrderValue": 0, "weeklyRevenue": []
        }

@router.get("/restaurant/{restaurant_id}/ai-combos")
def get_ai_combos(restaurant_id: str, db: Session = Depends(get_db)):
    """Generate smart AI combos based on the restaurant's menu items"""
    items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
    if not items:
        return {"combos": [], "message": "Add some menu items first to generate combos!"}
        
    menu_data = [
        {
            "name": str(item.name),
            "description": str(item.description) if item.description else "",
            "price": float(str(item.price))
        }
        for item in items
    ]
    
    combos = generate_combos(menu_data)
    return {"combos": combos}