from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import re
from typing import Optional, List
from app.core.database import get_db
from app.models.marketplace import Restaurant, MenuItem
from app.services.ai_service import get_dynamic_pricing, parse_vibe_intent, get_ai_pairing_suggestions, analyze_fraud_report, chat_with_ai

router = APIRouter()

class VibeSearchRequest(BaseModel):
    query: str

@router.post("/vibe-search")
def vibe_and_decision_search(req: VibeSearchRequest, db: Session = Depends(get_db)):
    raw_query = req.query.strip()
    
    # 1. USE AI TO PARSE INTENT
    intent = parse_vibe_intent(raw_query)
    budget_limit = intent.get("budget") or 1000.0
    keywords = intent.get("keywords") or []
    category_intent = intent.get("category")
    
    if not keywords and raw_query:
        # fallback
        keywords = [w for w in re.split(r'\W+', raw_query.lower()) if len(w) > 2]
    
    # 2. SCAN THE DATABASE FOR MATCHING CRAVINGS
    all_items = db.query(MenuItem).filter(MenuItem.price <= budget_limit, MenuItem.is_available == True).all()
    
    matched_items = []
    for item in all_items:
        item_text = f"{item.name} {item.category or ''} {item.description or ''}".lower()
        
        # Check if item text matches any of the AI keywords or category
        matches_keyword = any(k.lower() in item_text for k in keywords) if keywords else True
        matches_category = category_intent.lower() in item_text if category_intent else True
        
        if (matches_keyword or matches_category) and keywords:
            matched_items.append(item)
            
    if not matched_items:
        raise HTTPException(status_code=404, detail="No dishes matched your current vibe or budget.")

    # 3. GROUP BY RESTAURANT TO FIND CONTENDERS
    restaurant_scores = {}
    for item in matched_items:
        rest_id = str(item.restaurant_id)
        if rest_id not in restaurant_scores:
            rest = db.query(Restaurant).filter(Restaurant.id == item.restaurant_id).first()
            if rest:
                restaurant_scores[rest_id] = {
                    "details": rest,
                    "matching_items": [],
                    "avg_price": 0
                }
        if rest_id in restaurant_scores:
            restaurant_scores[rest_id]["matching_items"].append(item)

    # Convert to sorted list based on restaurant rating and matching density
    contenders = []
    for r_id, data in restaurant_scores.items():
        rest_obj = data["details"]
        items_list = data["matching_items"]
        avg_p = sum(i.price for i in items_list) / len(items_list)
        
        contenders.append({
            "id": str(rest_obj.id),
            "name": rest_obj.name,
            "rating": rest_obj.rating or 4.0,
            "image_url": rest_obj.image_url,
            "best_dish": items_list[0].name,
            "dish_price": items_list[0].price,
            "delivery_time": "25 mins" if rest_obj.rating and rest_obj.rating > 4.5 else "35 mins", # Simulated
            "avg_price": avg_p
        })
        
    # Sort contenders by rating descending
    contenders = sorted(contenders, key=lambda x: x["rating"], reverse=True)

    # 4. THE TIE-BREAKER LOGIC (Solving Choice Paralysis)
    if len(contenders) >= 2:
        pick_a = contenders[0]
        pick_b = contenders[1]
        
        # Micro-algorithm to break choice deadlock
        # We value high ratings but break ties using price efficiency
        score_a = pick_a["rating"] * 100 - (pick_a["dish_price"] * 0.1)
        score_b = pick_b["rating"] * 100 - (pick_b["dish_price"] * 0.1)
        
        winner = pick_a if score_a >= score_b else pick_b
        loser = pick_b if score_a >= score_b else pick_a
        
        verdict = f"Skip the endless scrolling! Go with {winner['name']}. Their {winner['best_dish']} is highly rated and saves you money compared to ordering from {loser['name']}."
        
        showdown = {
            "has_split_decision": True,
            "verdict": verdict,
            "winner_id": winner["id"],
            "contender_a": pick_a,
            "contender_b": pick_b
        }
    else:
        # If only 1 restaurant matches, there's no choice confusion to solve!
        showdown = {
            "has_split_decision": False,
            "verdict": f"Clear choice! Only {contenders[0]['name']} hits your exact criteria perfectly right now.",
            "winner_id": contenders[0]["id"],
            "contender_a": contenders[0],
            "contender_b": None
        }

    return showdown

@router.get("/search")
def unified_search(q: str, db: Session = Depends(get_db)):
    """
    Unified live search: returns matching restaurants AND matching menu items.
    Searches: restaurant name, menu item name, menu item category, menu item description.
    """
    if not q or len(q.strip()) < 1:
        return {"restaurants": [], "items": []}

    query = q.strip().lower()
    words = [w for w in re.split(r'\W+', query) if len(w) >= 2]

    # --- Search Restaurants ---
    all_restaurants = db.query(Restaurant).all()
    matched_restaurants = []
    for rest in all_restaurants:
        name_lower = rest.name.lower()
        desc_lower = (rest.description or '').lower()
        if any(w in name_lower or w in desc_lower for w in words):
            items = db.query(MenuItem).filter(
                MenuItem.restaurant_id == rest.id, MenuItem.is_available == True
            ).all()
            avg_price = round(sum(float(str(i.price)) for i in items) / len(items), 0) if items else 0
            categories = list(set(str(i.category) for i in items if i.category))
            matched_restaurants.append({
                "id": str(rest.id),
                "name": rest.name,
                "rating": rest.rating if rest.rating else 4.5,
                "image_url": rest.image_url or "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80",
                "tags": ", ".join(categories) if categories else (rest.description or ""),
                "delivery_time": "15–25 min" if (rest.rating or 0) >= 4.5 else "20–35 min",
                "avg_price": avg_price,
                "match_type": "restaurant",
            })

    # --- Search Menu Items ---
    all_items = db.query(MenuItem).filter(MenuItem.is_available == True).all()
    matched_items = []
    seen_ids = set()
    for item in all_items:
        item_name = item.name.lower()
        item_cat = (item.category or '').lower()
        item_desc = (item.description or '').lower()
        if any(w in item_name or w in item_cat or w in item_desc for w in words):
            if str(item.id) not in seen_ids:
                seen_ids.add(str(item.id))
                rest = db.query(Restaurant).filter(Restaurant.id == item.restaurant_id).first()
                matched_items.append({
                    "item_id": str(item.id),
                    "name": item.name,
                    "price": float(str(item.price)),
                    "category": item.category or "",
                    "image_url": item.image_url or "",
                    "restaurant_id": str(item.restaurant_id),
                    "restaurant_name": rest.name if rest else "Unknown",
                    "restaurant_rating": rest.rating if rest else 4.0,
                    "match_type": "item",
                })

    return {
        "restaurants": matched_restaurants[:8],
        "items": matched_items[:12],
        "total": len(matched_restaurants) + len(matched_items),
        "query": q,
    }


@router.get("/restaurants")
def get_live_restaurants(db: Session = Depends(get_db)):
    """Returns all restaurants with computed dynamic fields"""
    restaurants = db.query(Restaurant).all()
    
    feed = []
    for rest in restaurants:
        # Compute avg price from menu items
        items = db.query(MenuItem).filter(MenuItem.restaurant_id == rest.id, MenuItem.is_available == True).all()
        avg_price = round(sum(float(str(i.price)) for i in items) / len(items), 0) if items else 0
        categories = list(set(str(i.category) for i in items if i.category))
        
        # Dynamic delivery time based on rating
        delivery_time = "15–25 min" if (rest.rating or 0) >= 4.5 else "20–35 min"
        
        feed.append({
            "id": str(rest.id),
            "name": rest.name,
            "rating": rest.rating if rest.rating else 4.5,
            "time": delivery_time,
            "delivery_time": delivery_time,
            "tags": ", ".join(categories) if categories else (rest.description or ""),
            "category": categories[0].lower() if categories else "",
            "all_categories": categories,
            "avg_price": avg_price,
            "price": f"₹{int(avg_price)} for one" if avg_price else "₹200 for one",
            "menu_count": len(items),
            "img": rest.image_url or "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80",
            "image_url": rest.image_url or "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80",
            "address": rest.address,
            "latitude": rest.latitude,
            "longitude": rest.longitude,
        })
    return feed

class RatingRequest(BaseModel):
    order_id: str
    rating: int
    feedback: Optional[str] = None
    restaurant_id: Optional[str] = None

from typing import Optional

@router.post("/rate-order")
def rate_order(req: RatingRequest, db: Session = Depends(get_db)):
    """Submit a rating for a delivered order"""
    # Update restaurant rating (running average)
    if req.restaurant_id:
        rest = db.query(Restaurant).filter(Restaurant.id == req.restaurant_id).first()
        if rest:
            current = float(str(rest.rating)) if rest.rating is not None else 4.0
            # Simple EMA: blend new rating in
            rest.rating = round(current * 0.8 + req.rating * 0.2, 2)  # type: ignore[assignment]
            db.commit()
    print(f"⭐ Rating {req.rating}/5 received for order {req.order_id}")
    return {"status": "success", "message": "Thank you for your feedback!"}

@router.get("/order-history/{customer_id}")
def get_customer_order_history(customer_id: str, db: Session = Depends(get_db)):
    """Get full order history for a customer with restaurant details"""
    from app.models.orders import Order
    try:
        orders = db.query(Order).filter(Order.customer_id == customer_id).order_by(Order.created_at.desc()).all()
        result = []
        for o in orders:
            rest = db.query(Restaurant).filter(Restaurant.id == o.restaurant_id).first() if o.restaurant_id else None
            result.append({
                "id": o.id,
                "status": o.status,
                "items": o.item_description,
                "item_description": o.item_description,
                "total": f"₹{o.amount}",
                "amount": o.amount,
                "timestamp": o.created_at.isoformat() if o.created_at else None,
                "restaurant": {
                    "id": str(rest.id),
                    "name": rest.name,
                    "img": rest.image_url,
                    "image_url": rest.image_url,
                } if rest else None,
            })
        return result
    except Exception as e:
        return []

class AIPricingRequest(BaseModel):
    distance_km: float
    time_of_day: str
    weather: str
    active_orders: int

@router.post("/ai/pricing")
def calculate_dynamic_pricing(req: AIPricingRequest):
    """Calculate AI-powered dynamic delivery fee"""
    result = get_dynamic_pricing(
        distance_km=req.distance_km,
        time_of_day=req.time_of_day,
        weather=req.weather,
        active_orders=req.active_orders
    )
    return result

class FraudReportRequest(BaseModel):
    report_text: str
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    customer_email: Optional[str] = None

@router.post("/ai/fraud-report")
def report_fraud(req: FraudReportRequest):
    """Analyze a customer issue report using AI and auto-email owner if GENUINE"""
    analysis = analyze_fraud_report(
        report_text=req.report_text,
        customer_email=req.customer_email,
        order_id=req.order_id,
    )
    
    return {
        "status": "success",
        "message": "Issue report received and analyzed.",
        "analysis": analysis,
        "report_details": {
            "customer_id": req.customer_id,
            "order_id": req.order_id
        }
    }

class PairingRequest(BaseModel):
    cart_items: List[str]
    restaurant_id: str

@router.post("/ai/pairing")
def get_ai_pairing(req: PairingRequest, db: Session = Depends(get_db)):
    """Get smart AI pairings for items currently in cart"""
    items = db.query(MenuItem).filter(MenuItem.restaurant_id == req.restaurant_id, MenuItem.is_available == True).all()
    menu_data = [
        {
            "name": str(item.name),
            "description": str(item.description) if item.description else "",
            "price": float(str(item.price))
        }
        for item in items
    ]
    
    pairing = get_ai_pairing_suggestions(req.cart_items, menu_data)
    return pairing


class ChatMessageRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []


@router.post("/ai/chat")
def ai_chat(req: ChatMessageRequest, db: Session = Depends(get_db)):
    """Intelligent AI chat assistant — answers any customer question using Gemini with full app context."""
    # Fetch current restaurants to give the AI live context
    restaurants = []
    try:
        all_rests = db.query(Restaurant).all()
        for rest in all_rests:
            items = db.query(MenuItem).filter(
                MenuItem.restaurant_id == rest.id, MenuItem.is_available == True
            ).all()
            avg_price = round(sum(float(str(i.price)) for i in items) / len(items), 0) if items else 0
            categories = list(set(str(i.category) for i in items if i.category))
            delivery_time = "15–25 min" if (rest.rating or 0) >= 4.5 else "20–35 min"
            restaurants.append({
                "id": str(rest.id),
                "name": rest.name,
                "rating": rest.rating if rest.rating else 4.5,
                "tags": ", ".join(categories) if categories else (rest.description or ""),
                "delivery_time": delivery_time,
                "avg_price": avg_price,
                "image_url": rest.image_url or "",
                "best_dish": items[0].name if items else None,
                "dish_price": float(str(items[0].price)) if items else None,
            })
    except Exception as e:
        print(f"Error fetching restaurants for chat: {e}")

    result = chat_with_ai(
        user_message=req.message,
        chat_history=req.history or [],
        restaurants=restaurants if restaurants else None,
    )
    return result