from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

# 🚨 This is the exact 'router' that main.py is looking for!
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # This dictionary keeps track of every online rider
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, rider_id: str):
        await websocket.accept()
        self.active_connections[rider_id] = websocket
        print(f"🟢 [WebSocket] Rider {rider_id} is ONLINE and waiting for orders.")

    def disconnect(self, rider_id: str):
        if rider_id in self.active_connections:
            del self.active_connections[rider_id]
            print(f"🔴 [WebSocket] Rider {rider_id} disconnected.")

# Create the global switchboard that orders.py will use to send messages
manager = ConnectionManager()

# This is the endpoint your React frontend will connect to
@router.websocket("/ws/rider/{rider_id}")
async def websocket_endpoint(websocket: WebSocket, rider_id: str):
    await manager.connect(websocket, rider_id)
    try:
        while True:
            # We just wait here patiently to keep the connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(rider_id)