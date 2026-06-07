from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.models.marketplace import MarketplaceUser, Restaurant, MenuItem
from app.models.orders import Order
import uuid

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

class MenuItemCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    image_url: str

# --- Endpoints ---
@router.post("/login")
def partner_login(req: LoginRequest, db: Session = Depends(get_db)):
    # Find or create the partner user
    user = db.query(MarketplaceUser).filter(MarketplaceUser.email == req.email, MarketplaceUser.role == 'partner').first()
    if not user:
        user = MarketplaceUser(email=req.email, role='partner')
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # Check if they already have a restaurant registered
    restaurant = db.query(Restaurant).filter(Restaurant.owner_id == user.id).first()
    
    return {
        "partner_id": str(user.id),
        "restaurant": {
            "id": str(restaurant.id),
            "name": restaurant.name
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
    return {"id": str(new_rest.id), "name": new_rest.name}

@router.post("/restaurant/{restaurant_id}/menu")
def add_menu_item(restaurant_id: str, req: MenuItemCreate, db: Session = Depends(get_db)):
    new_item = MenuItem(
        restaurant_id=uuid.UUID(restaurant_id),
        name=req.name,
        description=req.description,
        price=req.price,
        category=req.category,
        image_url=req.image_url
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"status": "success", "item_name": new_item.name}

@router.get("/restaurant/{restaurant_id}/menu")
def get_menu(restaurant_id: str, db: Session = Depends(get_db)):
    items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
    return items

@router.get("/restaurant/{restaurant_id}/orders")
def get_restaurant_orders(restaurant_id: str, db: Session = Depends(get_db)):
    """Get all orders for a restaurant"""
    try:
        orders = db.query(Order).filter(Order.restaurant_id == restaurant_id).all()
        print(f"📋 Retrieved {len(orders)} orders for restaurant {restaurant_id}")
        return orders
    except Exception as e:
        print(f"❌ Error fetching restaurant orders: {e}")
        return []

@router.get("/restaurant/{restaurant_id}/analytics")
def get_restaurant_analytics(restaurant_id: str, db: Session = Depends(get_db)):
    return {
        "revenue": 4250,
        "ordersCount": 14,
        "avgRating": 4.8
    }