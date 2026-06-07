export const API_BASE = "http://127.0.0.1:8000/api/v1";
export const WS_BASE = "ws://127.0.0.1:8000";

// 🚨 GLOBAL STATE FOR REAL-TIME UPDATES
let orderUpdateCallbacks = [];
let connectionStatusCallbacks = [];

export const apiService = {
  getPartnerOrders: async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/orders?restaurant_id=${restaurantId}`);
      return res.ok ? await res.json() : [];
    } catch (e) { console.error("Failed to fetch partner orders:", e); return []; }
  },
  
  getOrderHistory: async (customerId) => {
    try {
      const res = await fetch(`${API_BASE}/orders?customer_id=${customerId}`);
      return res.ok ? await res.json() : [];
    } catch (e) { console.error("Failed to fetch order history:", e); return []; }
  },
  
  getRiderMetrics: async (riderId) => {
    try {
      const res = await fetch(`${API_BASE}/riders/${riderId}/metrics`);
      return res.ok ? await res.json() : { earnings: 0, trips: 0, rating: 4.5, acceptanceRate: 0 };
    } catch (e) { console.error("Failed to fetch rider metrics:", e); return { earnings: 0, trips: 0, rating: 4.5, acceptanceRate: 0 }; }
  },
  
  getPartnerAnalytics: async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/analytics`);
      return res.ok ? await res.json() : { revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0 };
    } catch (e) { console.error("Failed to fetch partner analytics:", e); return { revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0 }; }
  },

  // 🚨 NEW: WebSocket management system
  connectCustomerWS: (customerId, onUpdate, onStatusChange) => {
    return apiService._connectWebSocket('customer', customerId, onUpdate, onStatusChange);
  },

  connectPartnerWS: (partnerId, onUpdate, onStatusChange) => {
    return apiService._connectWebSocket('partner', partnerId, onUpdate, onStatusChange);
  },

  connectRiderWS: (riderId, onUpdate, onStatusChange) => {
    return apiService._connectWebSocket('rider', riderId, onUpdate, onStatusChange);
  },

  _connectWebSocket: (type, id, onUpdate, onStatusChange) => {
    const wsUrl = `${WS_BASE}/ws/${type}/${id}`;
    console.log(`📡 Attempting to connect ${type} WebSocket: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`🟢 ${type.toUpperCase()} WebSocket connected`);
        onStatusChange && onStatusChange('connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 ${type} received update:`, data);
          onUpdate && onUpdate(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`❌ ${type} WebSocket error:`, error);
        onStatusChange && onStatusChange('error');
      };
      
      ws.onclose = () => {
        console.log(`🔴 ${type} WebSocket disconnected`);
        onStatusChange && onStatusChange('disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          apiService._connectWebSocket(type, id, onUpdate, onStatusChange);
        }, 5000);
      };
      
      return ws;
    } catch (e) {
      console.error(`Failed to create ${type} WebSocket:`, e);
      return null;
    }
  },

  // 🚨 NEW: Send order update through WebSocket
  sendOrderUpdate: (ws, orderId, updateData) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        order_id: orderId,
        ...updateData
      }));
    } else {
      console.warn("WebSocket not ready. Current state:", ws?.readyState);
    }
  },

  // 🚨 NEW: Register callback for order updates
  onOrderUpdate: (callback) => {
    orderUpdateCallbacks.push(callback);
    return () => {
      orderUpdateCallbacks = orderUpdateCallbacks.filter(cb => cb !== callback);
    };
  },

  _notifyOrderUpdate: (update) => {
    orderUpdateCallbacks.forEach(cb => cb(update));
  },

  // 🚨 NEW: Fetch orders available for rider pickup from DB
  getAvailableOrdersForRider: async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/available-for-rider`);
      return res.ok ? await res.json() : [];
    } catch (e) { console.error("Failed to fetch available orders:", e); return []; }
  },

  // 🚨 NEW: Get single order status (for customer polling)
  getOrderStatus: async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`);
      return res.ok ? await res.json() : null;
    } catch (e) { console.error("Failed to fetch order status:", e); return null; }
  },

  // 🚨 NEW: Partner action helpers
  acceptOrderAsPartner: async (orderId, restaurantId) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}/accept?restaurant_id=${restaurantId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  },

  markOrderPreparing: async (orderId) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}/preparing`, {
      method: "PUT", headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  },

  markOrderReady: async (orderId) => {
    const res = await fetch(`${API_BASE}/orders/${orderId}/ready`, {
      method: "PUT", headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  },
};