import os
import json
from google import genai
from typing import List, Dict, Any, Optional
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

# ─────────────────────────────────────────────────────────────────
# Email Helper — sends an HTML alert to the owner via Resend API
# No SMTP password needed. Customer email is set as reply_to
# so the owner can click “Reply” in Gmail to respond directly.
# ─────────────────────────────────────────────────────────────────
def _send_owner_alert_email(
    owner_email: str,
    customer_email: str,
    order_id: Optional[str],
    report_text: str,
    analysis: Dict[str, Any],
) -> bool:
    """
    Sends a formatted HTML alert to the owner (localbitai@gmail.com) using Resend.
    - FROM: LocalBite AI <onboarding@resend.dev>  (system-generated, no password needed)
    - TO:   OWNER_EMAIL from .env
    - REPLY-TO: customer's email (so owner can click Reply to respond to customer)
    Requires RESEND_API_KEY in .env (free at resend.com — 3,000 emails/month).
    """
    import urllib.request
    import urllib.error

    resend_api_key = os.getenv("RESEND_API_KEY")
    if not resend_api_key:
        print("⚠️  RESEND_API_KEY not set in .env — skipping email.")
        return False

    urgency_color = {
        "Low": "#22c55e",
        "Medium": "#f59e0b",
        "High": "#ef4444",
        "Critical": "#7c3aed",
    }.get(analysis.get("urgency", "High"), "#ef4444")

    order_str = order_id or "N/A"
    steps_html = "".join(
        f"<li style='margin-bottom:8px;color:#e2e8f0;'>{s}</li>"
        for s in analysis.get("next_steps", [])
    )

    # ─ Reply-to banner: prominent customer contact section ──────────────────
    customer_display = customer_email if customer_email and customer_email != "(not provided)" else None
    reply_banner = ""
    if customer_display:
        reply_banner = f"""
          <div style='background:#1e3a5f;border:1px solid #3b82f6;border-radius:12px;padding:16px 20px;margin-bottom:20px;'>
            <p style='margin:0 0 4px;font-size:11px;color:#60a5fa;text-transform:uppercase;letter-spacing:1px;font-weight:700;'>&#128231; Reply Directly to Customer</p>
            <p style='margin:0;color:#93c5fd;font-size:14px;'>Hit <strong style='color:#fff;'>Reply</strong> in your Gmail to send a message directly to:</p>
            <p style='margin:8px 0 0;color:#fff;font-size:16px;font-weight:700;'>{customer_display}</p>
          </div>
        """

    html_body = f"""
    <html><body style='font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;margin:0;'>
      <div style='max-width:600px;margin:auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;'>

        <div style='background:{urgency_color};padding:20px 28px;'>
          <h1 style='margin:0;color:#fff;font-size:20px;letter-spacing:-0.3px;'>&#x26A0;&#xFE0F; LocalBite AI &mdash; Issue Alert</h1>
          <p style='margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;'>
            Urgency: <strong>{analysis.get('urgency','High')}</strong> &nbsp;|&nbsp;
            Category: <strong>{analysis.get('category','Unknown')}</strong>
          </p>
        </div>

        <div style='padding:24px 28px;'>

          {reply_banner}

          <!-- ★ REASON / CUSTOMER'S REPORT — shown first so you instantly know why -->
          <div style='background:#1a1a2e;border:1px solid #f59e0b;border-radius:12px;padding:18px 20px;margin-bottom:20px;'>
            <p style='margin:0 0 8px;font-size:11px;color:#f59e0b;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;'>&#128172; Customer's Reason for Reporting</p>
            <p style='margin:0;color:#fff;font-size:16px;font-weight:600;line-height:1.7;'>&ldquo;{report_text}&rdquo;</p>
          </div>

          <table style='width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;background:#0f172a;border-radius:10px;overflow:hidden;'>
            <tr style='border-bottom:1px solid #1e293b;'>
              <td style='padding:10px 14px;color:#64748b;width:130px;'>Customer Email</td>
              <td style='padding:10px 14px;color:#f1f5f9;font-weight:600;'>{customer_email}</td>
            </tr>
            <tr>
              <td style='padding:10px 14px;color:#64748b;'>Order ID</td>
              <td style='padding:10px 14px;color:#f1f5f9;font-weight:600;font-family:monospace;'>#{order_str}</td>
            </tr>
          </table>

          <div style='background:#0f172a;border-radius:10px;padding:16px;margin-bottom:16px;border-left:4px solid {urgency_color};'>
            <p style='margin:0 0 6px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;'>AI Summary</p>
            <p style='margin:0;color:#e2e8f0;line-height:1.6;'>{analysis.get('summary','')}</p>
          </div>

          <div style='background:#0f172a;border-radius:10px;padding:16px;'>
            <p style='margin:0 0 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;'>Recommended Next Steps</p>
            <ul style='margin:0;padding-left:18px;'>{steps_html}</ul>
          </div>

        </div>

        <div style='padding:14px 28px;border-top:1px solid #334155;text-align:center;'>
          <p style='margin:0;font-size:12px;color:#475569;'>LocalBite AI Automated Alert &nbsp;&middot;&nbsp; Sent via Resend</p>
        </div>
      </div>
    </body></html>
    """

    payload = json.dumps({
        "from": "LocalBite AI <onboarding@resend.dev>",
        "to": [owner_email],
        "reply_to": customer_display or owner_email,
        "subject": f"[LocalBite AI] \U0001F6A8 Genuine Issue \u2014 {analysis.get('urgency','High')} Urgency | Order #{order_str}",
        "html": html_body,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json",
                "User-Agent": "LocalBite-AI/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read())
            print(f"\u2705 Owner alert email sent → {owner_email}  (id: {result.get('id')})")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        print(f"\u274c Resend API error {e.code}: {error_body}")
        return False
    except Exception as e:
        print(f"\u274c Failed to send owner alert email via Resend: {e}")
        return False

def analyze_fraud_report(
    report_text: str,
    customer_email: Optional[str] = None,
    order_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Analyzes a customer issue report using Gemini AI.
    - Classifies verdict as GENUINE, SPAM, or VAGUE.
    - Auto-emails the owner when verdict is GENUINE.
    """
    if not client:
        return {
            "verdict": "GENUINE",
            "category": "Unknown",
            "urgency": "High",
            "summary": "AI disabled. Flagged for manual review.",
            "next_steps": ["Review the report manually and contact the customer."],
            "email_sent": False,
        }

    prompt = f"""
    You are an intelligent issue-validation agent for a food delivery platform called LocalBite AI.
    A customer has submitted the following support issue:
    ---
    "{report_text}"
    ---

    Your job is to:
    1. Classify this as one of three verdicts:
       - "GENUINE": A real, legitimate problem (e.g., wrong order, food tampered, driver misbehaved, payment issue, missing item).
       - "VAGUE": The report is too unclear to act on (e.g., "it was bad", "not good").
       - "SPAM": Clearly fake, a test, or an attempt to exploit (e.g., "free food please", "asdfgh").
    2. Identify the category (e.g., "Missing Item", "Payment Fraud", "Delivery Driver Complaint", "Food Quality", "Wrong Order", "Other").
    3. Assess urgency: "Low", "Medium", "High", or "Critical".
    4. Write a concise 1-2 sentence summary of the issue.
    5. Suggest 2-3 concrete next steps for the support team.

    Return ONLY a raw JSON object with these keys:
    - "verdict": string ("GENUINE", "SPAM", or "VAGUE")
    - "category": string
    - "urgency": string ("Low", "Medium", "High", "Critical")
    - "summary": string
    - "next_steps": array of strings

    Do not use markdown blocks, just raw JSON.
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )

        if not response.text:
            raise ValueError("Empty or blocked response from Gemini API")
        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:-3].strip()
        elif text.startswith('```'):
            text = text[3:-3].strip()

        data = json.loads(text)

        # ── Auto-email the owner if the issue is GENUINE ──────────────────────
        email_sent = False
        owner_email = os.getenv("OWNER_EMAIL")
        if data.get("verdict") == "GENUINE" and owner_email:
            email_sent = _send_owner_alert_email(
                owner_email=owner_email,
                customer_email=customer_email or "(not provided)",
                order_id=order_id,
                report_text=report_text,
                analysis=data,
            )

        data["email_sent"] = email_sent
        return data

    except Exception as e:
        print(f"Error in issue analysis: {e}")
        return {
            "verdict": "GENUINE",
            "category": "Error/Unknown",
            "urgency": "High",
            "summary": "Error analyzing report. Flagged for manual review.",
            "next_steps": ["Review the report manually."],
            "email_sent": False,
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
        if not response.text:
            raise ValueError("Empty or blocked response from AI model")
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
        if not response.text:
            raise ValueError("Empty or blocked response from AI model")
        text = response.text.strip()
        if text.startswith('```json'): text = text[7:-3].strip()
        elif text.startswith('```'): text = text[3:-3].strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print(f"Error generating AI pairing: {e}")
        return {"item": cart_items[0] if cart_items else "your meal", "suggestions": []}


def chat_with_ai(
    user_message: str,
    chat_history: List[Dict[str, str]],
    restaurants: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Full-context AI chat assistant for LocalBite customers.
    Answers ANY question intelligently — food recommendations, app help,
    order support, delivery info, promotions, general conversation, etc.
    Optionally suggests a restaurant when relevant.
    """
    if not client:
        return {
            "reply": "I'm sorry, the AI assistant is currently unavailable. Please try again later or contact support.",
            "restaurant": None,
        }

    # Build a compact restaurant list for context (top 10 by rating)
    restaurant_context = ""
    if restaurants:
        top = sorted(restaurants, key=lambda r: r.get("rating", 0), reverse=True)[:10]
        lines = [
            f"- {r['name']} (Rating: {r.get('rating', 4.0)}⭐, Categories: {r.get('tags', 'Various')}, "
            f"Delivery: {r.get('delivery_time', '20-30 min')}, Avg Price: ₹{r.get('avg_price', 200)})"
            for r in top
        ]
        restaurant_context = "\n".join(lines)
    else:
        restaurant_context = "(Restaurant data not available right now)"

    # Build conversation history string
    history_str = ""
    for msg in chat_history[-6:]:  # last 6 messages for context
        role = "Customer" if msg.get("role") == "user" else "Assistant"
        history_str += f"{role}: {msg.get('text', '')}\n"

    system_prompt = f"""
You are LocalBite AI, a friendly, smart, and helpful assistant for the LocalBite food delivery platform.
You are embedded in the customer app and can help with ANYTHING the customer asks.

Your personality:
- Warm, enthusiastic, and conversational
- Use emojis naturally (not excessively)
- Give concise, helpful answers (2-4 sentences unless more detail is needed)
- When food is mentioned, always try to suggest something from the available restaurants

About LocalBite platform:
- Food delivery app serving local restaurants
- Delivery fee: ₹40 normally, ₹60 during peak hours (12-2 PM and 7-9 PM), FREE on orders above ₹400
- Payment: Cash on Delivery (COD) and UPI (localbite@upi)
- Promo code: LOCALBITE10 gives 10% off
- Order tracking: Real-time GPS tracking with live rider location on map
- AI features: Mood-based search, vibe search, smart food pairing, split bill with friends
- Support: Customers can report issues via the "Report Issue" button in Order History
- Typical delivery: 15-35 minutes depending on restaurant and distance
- Ratings: Customers can rate orders after delivery
- Favorites: Heart icon on restaurant cards saves to favorites
- Split Bill: Friends can join a room with a PIN to order together and split the bill

Currently available restaurants:
{restaurant_context}

Conversation so far:
{history_str}
Customer: {user_message}

Respond naturally and helpfully. If the customer is asking about food or craving something, recommend a specific restaurant from the list above and mention their specialty.

Return your response as a JSON object with:
- "reply": your friendly text response (string)
- "recommend_restaurant_name": the EXACT name of a restaurant from the list to recommend, or null if not applicable

Return ONLY raw JSON, no markdown.
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_prompt,
        )

        if not response.text:
            raise ValueError("Empty response from Gemini")

        text = response.text.strip()
        if text.startswith('```json'):
            text = text[7:-3].strip()
        elif text.startswith('```'):
            text = text[3:-3].strip()

        data = json.loads(text)

        # Find the restaurant object if recommended
        recommended = None
        rec_name = data.get("recommend_restaurant_name")
        if rec_name and restaurants:
            for r in restaurants:
                if r.get("name", "").lower() == rec_name.lower():
                    recommended = r
                    break
            # fuzzy fallback — partial match
            if not recommended:
                for r in restaurants:
                    if rec_name.lower() in r.get("name", "").lower():
                        recommended = r
                        break

        return {
            "reply": data.get("reply", "I'm here to help! What would you like to know?"),
            "restaurant": recommended,
        }

    except Exception as e:
        print(f"Error in AI chat: {e}")
        # Graceful fallback responses
        lower_msg = user_message.lower()
        if any(w in lower_msg for w in ["delivery", "time", "how long", "eta"]):
            reply = "🕐 Delivery usually takes 15-35 minutes depending on the restaurant. You'll get live GPS tracking once a rider is assigned!"
        elif any(w in lower_msg for w in ["payment", "pay", "upi", "cash", "cod"]):
            reply = "💳 We accept Cash on Delivery (COD) and UPI (localbite@upi). You can choose at checkout!"
        elif any(w in lower_msg for w in ["promo", "discount", "coupon", "offer", "code"]):
            reply = "🎁 Use promo code **LOCALBITE10** for 10% off your order! Also, orders above ₹400 get free delivery 🚀"
        elif any(w in lower_msg for w in ["track", "where", "status", "order"]):
            reply = "📍 You can track your order in real-time on the map screen after placing your order. The rider's location updates live!"
        elif any(w in lower_msg for w in ["cancel", "refund", "wrong", "issue", "problem", "missing"]):
            reply = "⚠️ For issues with your order, go to Order History and tap the ⚠️ Report Issue button. Our AI will analyze it and notify the restaurant owner immediately."
        elif any(w in lower_msg for w in ["split", "friend", "group", "together"]):
            reply = "👥 Use the Split Bill feature in your cart! Create a room with a PIN, share the code with friends, and everyone can add their items before placing one combined order."
        else:
            reply = "I'm here to help! 😊 You can ask me about restaurants, delivery, payments, order tracking, or just tell me what you're craving!"
        return {"reply": reply, "restaurant": None}
