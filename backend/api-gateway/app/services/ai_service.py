import os
from google import genai
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Initialize Gemini API
# This assumes GEMINI_API_KEY is present in the environment or .env file
API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if API_KEY:
    client = genai.Client(api_key=API_KEY)
else:
    print("⚠️ WARNING: GEMINI_API_KEY is not set. AI features will not work.")

def get_dynamic_pricing(distance_km: float, time_of_day: str, weather: str, active_orders: int) -> Dict[str, Any]:
    """
    Uses AI to determine a dynamic delivery fee and provides a reasoning.
    """
    if not client:
        return {"fee": 5.0, "reason": "Default fee (AI disabled)"}
        
    prompt = f"""
    You are an intelligent pricing agent for a local food delivery app.
    Calculate a fair delivery fee in USD based on these parameters:
    - Distance: {distance_km} km
    - Time of day: {time_of_day}
    - Weather condition: {weather}
    - Current active orders (demand): {active_orders}

    Base fee is $2.00 for up to 2km in normal conditions.
    Return ONLY a JSON object with two keys: "fee" (a float) and "reason" (a short explanation).
    Do not use markdown blocks, just raw JSON.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        import json
        if not response.text:
            raise ValueError("Empty or blocked response from Gemini API")
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:-3].strip()
        elif text.startswith('```'):
            text = text[3:-3].strip()
            
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error in dynamic pricing: {e}")
        return {"fee": 5.0, "reason": "Error calculating dynamic pricing, fallback applied."}

def generate_combos(menu_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generates 2-3 combo suggestions based on the restaurant's menu items.
    """
    if not client:
        return [{"name": "Mock Combo", "description": "AI disabled", "items": [], "suggested_price": 0.0}]

    menu_text = "\n".join([f"- {item['name']} (${item['price']}): {item.get('description', '')}" for item in menu_items])
    
    prompt = f"""
    You are an expert restaurant menu strategist. Look at this restaurant's menu:
    
    {menu_text}
    
    Please generate 3 attractive Combo Deals by combining 2 to 3 items that pair well together.
    The suggested_price should be a 10-15% discount compared to buying them separately.
    
    Return ONLY a JSON array of objects, where each object has:
    - "name" (string): Catchy combo name
    - "description" (string): Short description
    - "items" (array of strings): Names of items included
    - "suggested_price" (float): The discounted combo price
    
    Do not use markdown blocks, just raw JSON.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        import json
        if not response.text:
            raise ValueError("Empty or blocked response from Gemini API")
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:-3].strip()
        elif text.startswith('```'):
            text = text[3:-3].strip()
            
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error in combo generation: {e}")
        return []

def analyze_fraud_report(report_text: str) -> Dict[str, Any]:
    """
    Analyzes a customer's fraud report using AI to categorize it, assess urgency, 
    and suggest next steps for customer support.
    """
    if not client:
        return {
            "is_fraud": True,
            "category": "Unknown",
            "urgency": "High",
            "summary": "AI disabled. Flagged for manual review.",
            "next_steps": ["Contact customer immediately"]
        }

    prompt = f"""
    You are an intelligent fraud detection agent for a food delivery platform.
    Analyze the following customer report of potential fraud or scam:
    "{report_text}"
    
    Please provide an analysis returning ONLY a JSON object with the following keys:
    - "is_fraud" (boolean): True if it seems like actual fraud or a scam, False if it's likely a normal complaint.
    - "category" (string): E.g., "Payment Fraud", "Fake Restaurant", "Delivery Driver Scam", "Account Takeover", "Other".
    - "urgency" (string): "Low", "Medium", "High", or "Critical".
    - "summary" (string): A 1-2 sentence summary of the issue.
    - "next_steps" (array of strings): 2-3 recommended actions for the support team.

    Do not use markdown blocks, just raw JSON.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        import json
        if not response.text:
            raise ValueError("Empty or blocked response from Gemini API")
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:-3].strip()
        elif text.startswith('```'):
            text = text[3:-3].strip()
            
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error in fraud analysis: {e}")
        return {
            "is_fraud": True,
            "category": "Error/Unknown",
            "urgency": "High",
            "summary": "Error analyzing report. Requires manual review.",
            "next_steps": ["Review manually"]
        }

def parse_vibe_intent(query: str) -> Dict[str, Any]:
    """
    Uses AI to parse a user's food vibe query into search filters.
    """
    if not client:
        import re
        budget_match = re.search(r'(?:under|below|budget|₹)\s*(\d+)', query.lower())
        budget_limit = float(budget_match.group(1)) if budget_match else 1000.0
        words = [w for w in re.split(r'\W+', query.lower()) if len(w) > 2]
        return {"keywords": words, "budget": budget_limit, "category": None}

    prompt = f"""
    You are an AI assistant for a food delivery app. A user is looking for food and says: "{query}"
    Extract their intent into a JSON object with the following keys:
    - "keywords": an array of descriptive words to search for in menu items (e.g., ["spicy", "biryani", "chicken", "sweet", "comfort"]). Extract at least 2-3 good keywords to maximize search success. Add synonyms if helpful.
    - "budget": a float representing the maximum price they want to pay, or null if not specified.
    - "category": a specific food category if mentioned (e.g., "pizza", "burger", "healthy", "dessert"), or null.
    
    Return ONLY raw JSON, with no markdown formatting.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        import json
        text = response.text.strip()
        if text.startswith('```json'): text = text[7:-3].strip()
        elif text.startswith('```'): text = text[3:-3].strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error parsing vibe intent: {e}")
        return {"keywords": query.lower().split(), "budget": 1000.0, "category": None}

def get_ai_pairing_suggestions(cart_items: List[str], menu_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Uses AI to recommend 2 items from the restaurant's menu that pair perfectly with the current cart.
    """
    if not client:
        return {"item": cart_items[0] if cart_items else "your meal", "suggestions": []}

    menu_text = "\n".join([f"- {item['name']} (₹{item['price']}): {item.get('description', '')}" for item in menu_items])
    cart_text = ", ".join(cart_items)

    prompt = f"""
    A customer just added these items to their cart: {cart_text}.
    Here is the restaurant's available menu:
    {menu_text}
    
    Suggest exactly 2 items from the menu that would perfectly pair with what they ordered (e.g., drinks, sides, desserts). 
    Do NOT suggest items they already have in their cart.
    Make sure the names and prices exactly match the menu provided.
    Pick a suitable emoji for each suggestion.

    Return ONLY a JSON object with this format:
    {{
      "item": "a short summary of what they ordered (e.g., 'your Biryani' or 'your Pizza')",
      "suggestions": [
        {{ "name": "Item Name from menu", "price": 49.0, "emoji": "🥤" }},
        {{ "name": "Another Item Name", "price": 99.0, "emoji": "🍰" }}
      ]
    }}
    
    Do not use markdown blocks, just raw JSON.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        import json
        text = response.text.strip()
        if text.startswith('```json'): text = text[7:-3].strip()
        elif text.startswith('```'): text = text[3:-3].strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error generating AI pairing: {e}")
        return {"item": cart_items[0] if cart_items else "your meal", "suggestions": []}
