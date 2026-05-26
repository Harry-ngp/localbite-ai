from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import json

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # We now track BOTH riders and customers!
        self.rider_connections: Dict[str, WebSocket] = {}
        self.customer_connections: Dict[str, WebSocket] = {}

    async def connect_rider(self, websocket: WebSocket, rider_id: str):
        await websocket.accept()
        self.rider_connections[rider_id] = websocket
        print(f"🟢 [WebSocket] Rider {rider_id} is ONLINE.")

    async def connect_customer(self, websocket: WebSocket, tracking_id: str):
        await websocket.accept()
        self.customer_connections[tracking_id] = websocket
        print(f"🟢 [WebSocket] Customer tracking {tracking_id} is ONLINE.")

    # 🚨 NEW: The Broadcast Engine
    async def broadcast_to_customers(self, message: dict):
        for connection in self.customer_connections.values():
            await connection.send_text(json.dumps(message))

    def disconnect_rider(self, rider_id: str):
        if rider_id in self.rider_connections:
            del self.rider_connections[rider_id]

    def disconnect_customer(self, tracking_id: str):
        if tracking_id in self.customer_connections:
            del self.customer_connections[tracking_id]

manager = ConnectionManager()

# --- RIDER ENDPOINT ---
# --- RIDER ENDPOINT ---
@router.websocket("/ws/rider/{rider_id}")
async def rider_websocket(websocket: WebSocket, rider_id: str):
    await manager.connect_rider(websocket, rider_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            
            # 🚨 THE FIX: Allow BOTH gps updates AND delivery completions to pass through to the customer!
            if payload.get("type") in ["gps_update", "delivery_complete"]:
                await manager.broadcast_to_customers(payload)
                
    except WebSocketDisconnect:
        manager.disconnect_rider(rider_id)

# --- CUSTOMER ENDPOINT ---
@router.websocket("/ws/customer/{tracking_id}")
async def customer_websocket(websocket: WebSocket, tracking_id: str):
    await manager.connect_customer(websocket, tracking_id)
    try:
        while True:
            await websocket.receive_text() # Just keep the connection alive
    except WebSocketDisconnect:
        manager.disconnect_customer(tracking_id)