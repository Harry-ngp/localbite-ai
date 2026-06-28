"""
Split Bill API — LocalBite AI
Uses in-memory room store so any customer ID string is accepted (no DB UUID constraints).
Rooms expire after 2 hours of inactivity.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import random
import string
import time

router = APIRouter()

# ─── In-Memory Room Store ────────────────────────────────────────────────────
# Structure:
# rooms = {
#   "LB-XXXXXX": {
#     "host_id": str,
#     "room_pin": str,
#     "created_at": float,
#     "poll_requested": bool,        # host pressed "Poll Members"
#     "order_placed": bool,          # host placed the group order
#     "order_id": str | None,        # the DB order ID once placed
#     "delivery_status": str,        # "pending" | "delivered"
#     "members": {
#       user_id: {
#         "user_id": str,
#         "display_name": str,
#         "cart_total": float,
#         "cart_items": list,        # [{ "name": str, "quantity": int, "price": float }]
#         "is_ready": bool,
#         "joined_at": float,
#       }
#     }
#   }
# }

rooms: Dict[str, dict] = {}

ROOM_TTL_SECONDS = 7200  # 2 hours


def _gc_rooms():
    """Remove expired rooms."""
    now = time.time()
    expired = [code for code, r in rooms.items() if now - r["created_at"] > ROOM_TTL_SECONDS]
    for code in expired:
        del rooms[code]


def _get_room_or_404(room_code: str) -> dict:
    _gc_rooms()
    room = rooms.get(room_code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found or expired")
    return room


def _room_summary(room_code: str, room: dict, requester_id: str):
    """Build the full room summary returned to clients."""
    members_list = list(room["members"].values())
    total_cart = sum(m["cart_total"] for m in members_list)
    member_count = len(members_list)
    all_ready = member_count > 0 and all(m["is_ready"] for m in members_list)
    is_host = room["host_id"] == requester_id

    return {
        "room_code": room_code,
        "host_id": room["host_id"],
        "is_host": is_host,
        "poll_requested": room["poll_requested"],
        "order_placed": room["order_placed"],
        "order_id": room["order_id"],
        "delivery_status": room["delivery_status"],
        "member_count": member_count,
        "all_ready": all_ready,
        "total_cart": round(total_cart, 2),
        "members": [
            {
                "user_id": m["user_id"],
                "display_name": m["display_name"],
                "cart_total": m["cart_total"],
                "cart_items": m["cart_items"],
                "is_ready": m["is_ready"],
                "is_host": m["user_id"] == room["host_id"],
            }
            for m in members_list
        ],
    }


# ─── Request / Response Models ───────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    host_id: str
    room_pin: str
    display_name: Optional[str] = "Host"
    cart_total: Optional[float] = 0.0
    cart_items: Optional[List[dict]] = []


class JoinRoomRequest(BaseModel):
    user_id: str
    room_code: str
    room_pin: str
    display_name: Optional[str] = "Guest"
    cart_total: Optional[float] = 0.0
    cart_items: Optional[List[dict]] = []


class UpdateCostRequest(BaseModel):
    user_id: str
    cart_total: float
    cart_items: Optional[List[dict]] = []


class ReadyRequest(BaseModel):
    user_id: str
    is_ready: bool = True


class PollRequest(BaseModel):
    host_id: str


class OrderPlacedRequest(BaseModel):
    host_id: str
    order_id: str


class DeliveredRequest(BaseModel):
    host_id: str


class StatusRequest(BaseModel):
    user_id: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/create")
async def create_room(request: CreateRoomRequest):
    _gc_rooms()

    # Generate unique 6-char code
    for _ in range(20):
        code = "LB-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique room code")

    rooms[code] = {
        "host_id": request.host_id,
        "room_pin": request.room_pin,
        "created_at": time.time(),
        "poll_requested": False,
        "order_placed": False,
        "order_id": None,
        "delivery_status": "pending",
        "members": {
            request.host_id: {
                "user_id": request.host_id,
                "display_name": request.display_name or "Host",
                "cart_total": request.cart_total or 0.0,
                "cart_items": request.cart_items or [],
                "is_ready": False,
                "joined_at": time.time(),
            }
        },
    }

    return {
        "room_code": code,
        "host_id": request.host_id,
        "is_host": True,
        "poll_requested": False,
        "order_placed": False,
        "order_id": None,
        "delivery_status": "pending",
        "member_count": 1,
        "all_ready": False,
        "total_cart": request.cart_total or 0.0,
        "members": [
            {
                "user_id": request.host_id,
                "display_name": request.display_name or "Host",
                "cart_total": request.cart_total or 0.0,
                "cart_items": request.cart_items or [],
                "is_ready": False,
                "is_host": True,
            }
        ],
    }


@router.post("/join")
async def join_room(request: JoinRoomRequest):
    room_code = request.room_code.upper()
    room = _get_room_or_404(room_code)

    if room["room_pin"] != request.room_pin:
        raise HTTPException(status_code=403, detail="Invalid PIN")

    # Upsert member
    room["members"][request.user_id] = {
        "user_id": request.user_id,
        "display_name": request.display_name or "Guest",
        "cart_total": request.cart_total or 0.0,
        "cart_items": request.cart_items or [],
        "is_ready": room["members"].get(request.user_id, {}).get("is_ready", False),
        "joined_at": room["members"].get(request.user_id, {}).get("joined_at", time.time()),
    }

    return _room_summary(room_code, room, request.user_id)


@router.get("/room/{room_code}")
async def get_room_status(room_code: str, user_id: str):
    """Poll endpoint — returns full room state for a member."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)
    return _room_summary(room_code, room, user_id)


@router.post("/room/{room_code}/update-cost")
async def update_member_cost(room_code: str, request: UpdateCostRequest):
    """Called when a member's cart changes — syncs their cost into the room."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if request.user_id not in room["members"]:
        raise HTTPException(status_code=404, detail="You are not a member of this room")

    member = room["members"][request.user_id]
    member["cart_total"] = request.cart_total
    member["cart_items"] = request.cart_items or []
    # Reset ready when cost changes
    member["is_ready"] = False

    return _room_summary(room_code, room, request.user_id)


@router.post("/room/{room_code}/ready")
async def set_ready(room_code: str, request: ReadyRequest):
    """Member marks themselves as ready (or un-ready)."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if request.user_id not in room["members"]:
        raise HTTPException(status_code=404, detail="You are not a member of this room")

    room["members"][request.user_id]["is_ready"] = request.is_ready

    return _room_summary(room_code, room, request.user_id)


@router.post("/room/{room_code}/poll")
async def poll_members(room_code: str, request: PollRequest):
    """Host sends a 'please press ready' notification to all members."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if room["host_id"] != request.host_id:
        raise HTTPException(status_code=403, detail="Only the host can poll members")

    room["poll_requested"] = True

    return {"message": "Poll sent to all members", "room_code": room_code}


@router.post("/room/{room_code}/order-placed")
async def mark_order_placed(room_code: str, request: OrderPlacedRequest):
    """Host marks the room as order placed — guests poll and see the notification."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if room["host_id"] != request.host_id:
        raise HTTPException(status_code=403, detail="Only the host can update order status")

    room["order_placed"] = True
    room["order_id"] = request.order_id

    return {"message": "Room marked as order placed", "room_code": room_code, "order_id": request.order_id}


@router.post("/room/{room_code}/delivered")
async def mark_delivered(room_code: str, request: DeliveredRequest):
    """Host marks the room as delivered — guests poll and see the delivery notification."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if room["host_id"] != request.host_id:
        raise HTTPException(status_code=403, detail="Only the host can update delivery status")

    room["delivery_status"] = "delivered"

    return {"message": "Room marked as delivered", "room_code": room_code}


@router.post("/room/{room_code}/close")
async def close_room(room_code: str, request: PollRequest):
    """Host closes the room after delivery (or cancels it)."""
    room_code = room_code.upper()
    room = _get_room_or_404(room_code)

    if room["host_id"] != request.host_id:
        raise HTTPException(status_code=403, detail="Only the host can close the room")

    del rooms[room_code]
    return {"message": "Room closed", "room_code": room_code}
