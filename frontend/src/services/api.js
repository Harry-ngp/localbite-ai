export const API_BASE = "http://127.0.0.1:8000/api/v1";
export const WS_BASE  = "ws://127.0.0.1:8000";

// ─── WebSocket Callback Registry ─────────────────────────────────────────────
let orderUpdateCallbacks = [];
let connectionStatusCallbacks = [];

// ─── Main Service Object ──────────────────────────────────────────────────────
export const apiService = {

  // ═══ PARTNER ══════════════════════════════════════════════════════════════
  getPartnerOrders: async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/orders`);
      return res.ok ? await res.json() : [];
    } catch { return []; }
  },

  getPartnerAnalytics: async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/analytics`);
      return res.ok ? await res.json() : { revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0, weeklyRevenue: [] };
    } catch { return { revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0, weeklyRevenue: [] }; }
  },

  updateMenuItem: async (restaurantId, itemId, data) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/menu/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },

  deleteMenuItem: async (restaurantId, itemId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/menu/${itemId}`, {
        method: "DELETE",
      });
      return res.ok;
    } catch { return false; }
  },

  updateRestaurant: async (partnerId, restaurantId, data) => {
    try {
      const res = await fetch(`${API_BASE}/partners/${partnerId}/restaurant/${restaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },

  // ═══ CUSTOMER ═════════════════════════════════════════════════════════════
  getOrderHistory: async (customerId) => {
    try {
      const res = await fetch(`${API_BASE}/customer/order-history/${customerId}`);
      return res.ok ? await res.json() : [];
    } catch { return []; }
  },

  rateOrder: async (orderId, rating, feedback, restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/customer/rate-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, rating, feedback: feedback || null, restaurant_id: restaurantId || null }),
      });
      return res.ok;
    } catch { return false; }
  },

  // ═══ RIDER ════════════════════════════════════════════════════════════════
  getRiderMetrics: async (riderId) => {
    try {
      const res = await fetch(`${API_BASE}/riders/${riderId}/metrics`);
      return res.ok ? await res.json() : { rating: 4.8, acceptanceRate: 92, todayTrips: 0, streak: 0 };
    } catch { return { rating: 4.8, acceptanceRate: 92, todayTrips: 0, streak: 0 }; }
  },

  getRiderEarnings: async (riderId) => {
    try {
      const res = await fetch(`${API_BASE}/riders/${riderId}/earnings`);
      return res.ok ? await res.json() : { total_earnings: 0, completed_trips: 0, weekly_earnings: [], trip_history: [] };
    } catch { return { total_earnings: 0, completed_trips: 0, weekly_earnings: [], trip_history: [] }; }
  },

  getAvailableOrdersForRider: async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/available-for-rider`);
      return res.ok ? await res.json() : [];
    } catch { return []; }
  },

  // ═══ ORDERS ═══════════════════════════════════════════════════════════════
  getOrderStatus: async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  },

  acceptOrderAsPartner: async (orderId, restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/accept?restaurant_id=${restaurantId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch { return false; }
  },

  markOrderPreparing: async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/preparing`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch { return false; }
  },

  markOrderReady: async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/ready`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch { return false; }
  },

  // ═══ WEBSOCKET ════════════════════════════════════════════════════════════
  connectCustomerWS: (customerId, onUpdate, onStatusChange) =>
    apiService._connectWebSocket('customer', customerId, onUpdate, onStatusChange),

  connectPartnerWS: (partnerId, onUpdate, onStatusChange) =>
    apiService._connectWebSocket('partner', partnerId, onUpdate, onStatusChange),

  connectRiderWS: (riderId, onUpdate, onStatusChange) =>
    apiService._connectWebSocket('rider', riderId, onUpdate, onStatusChange),

  _connectWebSocket: (type, id, onUpdate, onStatusChange) => {
    const wsUrl = `${WS_BASE}/ws/${type}/${id}`;
    console.log(`📡 Connecting ${type} WebSocket: ${wsUrl}`);
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen    = () => { console.log(`🟢 ${type} WS connected`); onStatusChange?.('connected'); };
      ws.onmessage = (event) => {
        try { onUpdate?.(JSON.parse(event.data)); } catch {}
      };
      ws.onerror   = () => { onStatusChange?.('error'); };
      ws.onclose   = () => {
        if (ws.__intentional_close) return;
        console.log(`🔴 ${type} WS closed`); onStatusChange?.('disconnected');
        setTimeout(() => apiService._connectWebSocket(type, id, onUpdate, onStatusChange), 5000);
      };
      
      const originalClose = ws.close.bind(ws);
      ws.close = () => {
        ws.__intentional_close = true;
        originalClose();
      };
      
      return ws;
    } catch { return null; }
  },

  sendOrderUpdate: (ws, orderId, updateData) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ order_id: orderId, ...updateData }));
    }
  },

  onOrderUpdate: (callback) => {
    orderUpdateCallbacks.push(callback);
    return () => { orderUpdateCallbacks = orderUpdateCallbacks.filter(cb => cb !== callback); };
  },

  _notifyOrderUpdate: (update) => { orderUpdateCallbacks.forEach(cb => cb(update)); },
};