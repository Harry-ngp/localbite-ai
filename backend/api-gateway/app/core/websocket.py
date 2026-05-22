from fastapi import WebSocket
from typing import Dict

class ConnectionManager:
    def __init__(self):
        # This dictionary maps a rider_id to their active WebSocket tunnel
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, rider_id: str):
        # Accept the incoming connection
        await websocket.accept()
        # Store it in our dictionary
        self.active_connections[rider_id] = websocket
        print(f"📡 Rider {rider_id} connected to the dispatch grid.")

    def disconnect(self, rider_id: str):
        # Remove the rider if they close the app or lose cell service
        if rider_id in self.active_connections:
            del self.active_connections[rider_id]
            print(f"🔌 Rider {rider_id} disconnected.")

    async def send_personal_message(self, message: dict, rider_id: str):
        # Push a JSON notification to a specific rider
        if rider_id in self.active_connections:
            websocket = self.active_connections[rider_id]
            await websocket.send_json(message)

# Create a single, global instance of our switchboard
manager = ConnectionManager()