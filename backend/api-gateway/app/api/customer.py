from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import re
from app.core.database import get_db
from app.models.marketplace import Restaurant, MenuItem

router = APIRouter()

class VibeSearchRequest(BaseModel):
    query: str

@router.post("/vibe-search")
def vibe_and_decision_search(req: VibeSearchRequest, db: Session = Depends(get_db)):
    raw_query = req.query.lower()
    
    # 1. THE BUDGET PARSER (Regex extraction)
    # Looks for patterns like "under 300", "below 500", "under ₹400"
    budget_match = re.search(r'(?:under|below|budget|₹)\s*(\d+)', raw_query)
    budget_limit = float(budget_match.group(1)) if budget_match else 1000.0 # Default high if not specified
    
    # 2. SCAN THE DATABASE FOR MATCHING CRAVINGS
    # We pull all items fitting the budget limit
    all_items = db.query(MenuItem).filter(MenuItem.price <= budget_limit, MenuItem.is_available == True).all()
    
    matched_items = []
    for item in all_items:
        # Check if item name, description or category matches any word in the user's confused query
        words = [w for w in re.split(r'\W+', raw_query) if len(w) > 2]
        matches = any(word in item.name.lower() or word in item.category.lower() for word in words)
        if matches:
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

@router.get("/restaurants")
def get_live_restaurants(db: Session = Depends(get_db)):
    # Fetch all restaurants from Supabase
    restaurants = db.query(Restaurant).all()
    
    feed = []
    for rest in restaurants:
        feed.append({
            "id": str(rest.id),
            "name": rest.name,
            "rating": rest.rating if rest.rating else 4.5, # Default rating for new kitchens
            "time": "25-30 min", 
            "tags": rest.description,
            "price": "₹200 for one", # We can make this dynamic later based on menu average
            "img": rest.image_url or "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80"
        })
    return feed