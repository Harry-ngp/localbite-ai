from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Track connections for all three stakeholders
        self.rider_connections: Dict[str, WebSocket] = {}
        self.customer_connections: Dict[str, WebSocket] = {}
        self.partner_connections: Dict[str, WebSocket] = {}
        
        # Track which orders are being watched by whom
        self.order_subscribers: Dict[str, List[str]] = {}  # order_id -> [customer_ids, rider_ids, partner_ids]

    async def connect_rider(self, websocket: WebSocket, rider_id: str):
        await websocket.accept()
        self.rider_connections[rider_id] = websocket
        print(f"🟢 [WebSocket] Rider {rider_id} is ONLINE. Total riders: {len(self.rider_connections)}")

    async def connect_customer(self, websocket: WebSocket, customer_id: str):
        await websocket.accept()
        self.customer_connections[customer_id] = websocket
        print(f"🟢 [WebSocket] Customer {customer_id} is ONLINE. Total customers: {len(self.customer_connections)}")

    async def connect_partner(self, websocket: WebSocket, partner_id: str):
        await websocket.accept()
        self.partner_connections[partner_id] = websocket
        print(f"🟢 [WebSocket] Partner {partner_id} is ONLINE. Total partners: {len(self.partner_connections)}")

    # 🚨 ENHANCED: Broadcast to specific order subscribers
    async def broadcast_order_update(self, order_id: str, message: dict):
        """Broadcast order update to ALL interested parties (customer, partner, rider)"""
        message['order_id'] = order_id
        message['timestamp'] = str(asyncio.get_event_loop().time())
        
        # Broadcast to ALL customers watching this order
        disconnected_customers = []
        for customer_id, connection in self.customer_connections.items():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"❌ Failed to send to customer {customer_id}: {e}")
                disconnected_customers.append(customer_id)
        
        # Broadcast to ALL partners watching this order
        disconnected_partners = []
        for partner_id, connection in self.partner_connections.items():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"❌ Failed to send to partner {partner_id}: {e}")
                disconnected_partners.append(partner_id)
        
        # Broadcast to ALL riders watching this order
        disconnected_riders = []
        for rider_id, connection in self.rider_connections.items():
            try:
                await connection.send_text(json.dumps(message))
            except Exception as e:
                print(f"❌ Failed to send to rider {rider_id}: {e}")
                disconnected_riders.append(rider_id)
        
        # Clean up disconnected connections
        for customer_id in disconnected_customers:
            self.disconnect_customer(customer_id)
        for partner_id in disconnected_partners:
            self.disconnect_partner(partner_id)
        for rider_id in disconnected_riders:
            self.disconnect_rider(rider_id)

    def disconnect_rider(self, rider_id: str):
        if rider_id in self.rider_connections:
            del self.rider_connections[rider_id]
            print(f"🔴 Rider {rider_id} DISCONNECTED")

    def disconnect_customer(self, customer_id: str):
        if customer_id in self.customer_connections:
            del self.customer_connections[customer_id]
            print(f"🔴 Customer {customer_id} DISCONNECTED")

    def disconnect_partner(self, partner_id: str):
        if partner_id in self.partner_connections:
            del self.partner_connections[partner_id]
            print(f"🔴 Partner {partner_id} DISCONNECTED")

manager = ConnectionManager()

# --- RIDER ENDPOINT ---
@router.websocket("/ws/rider/{rider_id}")
async def rider_websocket(websocket: WebSocket, rider_id: str):
    await manager.connect_rider(websocket, rider_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            order_id = payload.get("order_id")
            
            # Broadcast to ALL stakeholders (customer, partner, rider)
            if order_id and payload.get("type") in ["gps_update", "delivery_complete", "delivery_started", "arrived_at_restaurant"]:
                await manager.broadcast_order_update(order_id, payload)
                
    except WebSocketDisconnect:
        manager.disconnect_rider(rider_id)

# --- CUSTOMER ENDPOINT ---
@router.websocket("/ws/customer/{customer_id}")
async def customer_websocket(websocket: WebSocket, customer_id: str):
    await manager.connect_customer(websocket, customer_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            order_id = payload.get("order_id")
            
            # Customer sending order placement or status check
            if order_id and payload.get("type") == "order_placed":
                await manager.broadcast_order_update(order_id, payload)
                
    except WebSocketDisconnect:
        manager.disconnect_customer(customer_id)

# --- PARTNER ENDPOINT (NEW!)---
@router.websocket("/ws/partner/{partner_id}")
async def partner_websocket(websocket: WebSocket, partner_id: str):
    await manager.connect_partner(websocket, partner_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            payload = json.loads(raw_data)
            order_id = payload.get("order_id")
            
            # Partner updating order status
            if order_id and payload.get("type") in ["order_accepted", "preparing", "ready_for_pickup", "order_cancelled"]:
                await manager.broadcast_order_update(order_id, payload)
                
    except WebSocketDisconnect:
        manager.disconnect_partner(partner_id)