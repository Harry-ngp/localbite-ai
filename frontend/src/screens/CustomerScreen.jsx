import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';

const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1986/1986937.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export default function CustomerScreen({ goBack, addGlobalOrder }) {
  // ==========================================
  // 1. THE CUSTOMER SCREEN (LIVE MENU & CART ENGINE)
  // ==========================================
    // --- MOCK DATA FOR CATEGORIES ---
    const categories = [
      { name: 'Biryani', icon: '🥘' }, { name: 'Pizza', icon: '🍕' }, 
      { name: 'Burger', icon: '🍔' }, { name: 'Healthy', icon: '🥗' },
      { name: 'Dessert', icon: '🍰' }, { name: 'Coffee', icon: '☕' }
    ];
  
    // --- CORE STATES ---
    const [restaurants, setRestaurants] = useState([]);
    const [isTracking, setIsTracking] = useState(false);
    const [status, setStatus] = useState('');
    
    // --- 🚨 NEW: MENU & CART STATES ---
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    const [restaurantMenu, setRestaurantMenu] = useState([]);
    const [cart, setCart] = useState([]); // Array of { ...item, quantity }
    
    // --- 🚨 NEW: ORDER HISTORY & FAVORITES ---
    const [orderHistory, setOrderHistory] = useState([]);
    const [favoriteRestaurants, setFavoriteRestaurants] = useState([]);
    const [savedAddresses, setSavedAddresses] = useState([]);
    const [currentCustomerId] = useState(() => {
      const stored = localStorage.getItem('localbite_customer_id');
      if (stored) return stored;
      const newId = 'customer_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('localbite_customer_id', newId);
      return newId;
    });
    
    // Tracking States
    const [riderLocation, setRiderLocation] = useState(null);
    const [pathHistory, setPathHistory] = useState([]);
    const [isDelivered, setIsDelivered] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [feedbackSaved, setFeedbackSaved] = useState(false);
    const [currentOrderId, setCurrentOrderId] = useState(null);
    const wsRef = useRef(null);
    const [wsStatus, setWsStatus] = useState('disconnected'); // 'connected', 'error', 'disconnected'
    const [orderRequestFlow, setOrderRequestFlow] = useState({
      customerPlaced: true,
      restaurantAccepted: false,
      riderAssigned: false,
      riderName: null,
      restaurantName: null
    });
  
    // AI States
    const [vibeQuery, setVibeQuery] = useState('');
    const [aiDecision, setAiDecision] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    
    const [viewMode, setViewMode] = useState('home'); // 'home', 'history', 'favorites'
  
    // --- 🚨 NEW: SPLIT BILL STATES ---
    const [showCheckoutOptions, setShowCheckoutOptions] = useState(false);
    const [splitRoomMode, setSplitRoomMode] = useState(false);
    const [splitFriends, setSplitFriends] = useState([{ id: 1, name: 'You (Host)', amount: 0, isReady: true }]);
    
    // --- API SPLIT ROOM STATE ---
    const [roomState, setRoomState] = useState('idle'); // idle, create, join, active
    const [roomPin, setRoomPin] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [roomDetails, setRoomDetails] = useState(null);
    
    const deliveryFee = 40;
    const gstRate = 0.05;

    // --- 1. INITIALIZE LIVE FEED & LOAD ORDER HISTORY ---
    useEffect(() => {
      fetch("http://127.0.0.1:8000/api/v1/customer/restaurants")
        .then(res => res.json())
        .then(data => setRestaurants(data))
        .catch(err => console.log("Failed to load feed"));
      
      // 🚨 NEW: Load order history from backend
      apiService.getOrderHistory(currentCustomerId).then(orders => {
        setOrderHistory(orders);
        // Extract favorite restaurants from order history
        const favs = [...new Map(orders.map(o => [o.restaurant_id, o.restaurant])).values()];
        setFavoriteRestaurants(favs);
      });
      
      // Load saved addresses from localStorage
      const saved = localStorage.getItem('savedAddresses');
      if (saved) setSavedAddresses(JSON.parse(saved));
    }, []);

    useEffect(() => {
      wsRef.current = apiService.connectCustomerWS(
        currentCustomerId,
        (data) => {
          console.log("📨 Customer received:", data);
          
          if (data.type === "order_accepted" || data.type === "order_preparing") {
            setOrderRequestFlow(prev => ({ ...prev, restaurantAccepted: true, restaurantName: data.restaurant_name || "Restaurant" }));
            setStatus(data.type === "order_accepted" 
              ? `✅ Accepted by ${data.restaurant_name || 'Restaurant'}! Preparing your food...`
              : `👨🍳 Your food is being prepared!`);
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
          }
          
          if (data.type === "food_ready" || data.type === "order_ready_for_pickup") {
            setStatus(`✅ Your food is ready! Looking for a rider...`);
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
          }
          
          if (data.type === "rider_assigned") {
            setOrderRequestFlow(prev => ({ ...prev, riderAssigned: true, riderName: data.rider_name || data.rider_id || "Rider" }));
            setStatus(`🛵 Rider ${data.rider_name || data.rider_id || ''} is on the way!`);
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
          }
          
          if (data.type === "delivery_started") {
            setStatus('🚀 Order picked up! Rider is heading your way!');
          }
          
          if (data.type === "delivery_complete" || data.type === "delivered") {
            setStatus('🎉 FOOD DELIVERED!');
            setIsDelivered(true);
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
          }
        },
        (connStatus) => {
          setWsStatus(connStatus);
        }
      );
      
      return () => {
        if (wsRef.current) wsRef.current.close();
      };
    }, [currentCustomerId]);

    // --- 🚨 ZOMATO-STYLE RIDER ANIMATION ---
    useEffect(() => {
      let interval;
      if (orderRequestFlow.riderAssigned && !isDelivered) {
        // Start from restaurant
        setRiderLocation([12.9816, 77.5846]);
        
        // Define path coordinates (from restaurant to customer)
        const path = [[12.9816, 77.5846], [12.9791, 77.5871], [12.9766, 77.5896], [12.9741, 77.5921], [12.9716, 77.5946]];
        let currentStep = 0;
        
        interval = setInterval(() => {
          if (currentStep < path.length - 1) {
            currentStep++;
            setRiderLocation(path[currentStep]);
          } else {
            // Reached destination
            clearInterval(interval);
          }
        }, 4000); // Move every 4 seconds
      }
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [orderRequestFlow.riderAssigned, isDelivered]);
  
    // --- 2. AI SEARCH FUNCTION ---
    const handleVibeSearch = async (e) => {
      if (e.key !== 'Enter' || !vibeQuery.trim()) return;
      setSearchLoading(true);
      setAiDecision(null);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/customer/vibe-search", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: vibeQuery })
        });
        if (res.ok) setAiDecision(await res.json());
        else {
          setStatus("❌ No matching restaurants found for that vibe.");
          setTimeout(() => setStatus(''), 3000);
        }
      } catch (err) {
        setStatus("❌ AI Engine offline.");
        setTimeout(() => setStatus(''), 3000);
      }
      setSearchLoading(false);
    };
  
    // --- 3. 🚨 FETCH LIVE MENU ---
    const openMenu = async (restaurant) => {
      setSelectedRestaurant(restaurant);
      setCart([]); // Clear cart when switching restaurants
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/partners/restaurant/${restaurant.id}/menu`);
        if (res.ok) setRestaurantMenu(await res.json());
      } catch (e) {
        console.log("Failed to fetch menu");
      }
    };
  
    // --- 4. 🚨 CART LOGIC ---
    const addToCart = (item) => {
      setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
        return [...prev, { ...item, quantity: 1 }];
      });
    };
  
    const removeFromCart = (itemId) => {
      setCart(prev => {
        const existing = prev.find(i => i.id === itemId);
        if (existing.quantity === 1) return prev.filter(i => i.id !== itemId);
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      });
    };
  
    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
    // --- 5. 🚨 DYNAMIC CHECKOUT WITH ORDER TRACKING ---
  // --- SPLIT ROOM API HANDLERS ---
  const handleCreateRoom = async () => {
    if (!roomPin || roomPin.length < 4) return toast('PIN must be at least 4 digits', 'error');
    try {
      const response = await fetch('http://localhost:8000/api/v1/split/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: currentCustomerId, room_pin: roomPin })
      });
      if (!response.ok) throw new Error('Failed to create room');
      const data = await response.json();
      setRoomDetails({ ...data, isHost: true });
      setRoomState('active');
      toast(`Room Created! Code: ${data.room_code}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode || !roomPin) return toast('Enter Code and PIN', 'error');
    try {
      const response = await fetch('http://localhost:8000/api/v1/split/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentCustomerId, room_code: joinCode.toUpperCase(), room_pin: roomPin })
      });
      if (!response.ok) throw new Error('Invalid Code or PIN');
      const data = await response.json();
      setRoomDetails({ ...data, isHost: false });
      setRoomState('active');
      toast('Successfully joined the room!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const checkoutCart = async () => {
    if (cart.length === 0) return;
    setStatus(`⏳ Sending order to ${selectedRestaurant.name}...`);
    
    const itemDescription = cart.map(c => `${c.quantity}x ${c.name}`).join(', ');
    const currentRestId = selectedRestaurant.id;
    const currentRestName = selectedRestaurant.name;

    // 1. Send to backend FIRST to get real UUID
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/orders/", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          customer_name: "Customer", 
          delivery_address: "Current Location", 
          item_description: itemDescription, 
          amount: cartTotal, 
          volume_units: 20,
          restaurant_id: currentRestId,
          customer_id: currentCustomerId
        })
      });
      
      if (response.ok) {
        const createdOrder = await response.json();
        const realOrderId = createdOrder.id;
        console.log("✅ Order created on backend with ID:", realOrderId);
        
        // 2. Add to globalOrders with REAL backend ID
        if (addGlobalOrder) {
          addGlobalOrder({
            id: realOrderId,
            status: 'new',
            items: itemDescription,
            item_description: itemDescription,
            total: `₹${cartTotal}`,
            amount: cartTotal,
            time: 'Just now',
            kitchen: currentRestName,
            restaurant_name: currentRestName,
            restaurant_id: currentRestId,
            delivery_address: 'Current Location'
          });
        }

        // 3. Update local history with real ID
        const newOrder = {
          id: realOrderId,
          restaurant: selectedRestaurant,
          items: cart,
          total: cartTotal,
          timestamp: new Date().toISOString(),
          status: 'new'
        };
        setOrderHistory(prev => [newOrder, ...prev]);
        
        setCart([]);
        setSelectedRestaurant(null);
        setStatus(`✅ Order sent to ${currentRestName}!`);
        
        // 4. Start tracking with REAL backend ID
        startTracking(realOrderId);
      } else {
        console.error("❌ Backend error creating order");
        setStatus("❌ Failed to place order. Please try again.");
      }
    } catch (error) { 
      console.error("Backend connection failed:", error);
      setStatus("❌ Connection issue. Please try again.");
    }
  };

  // --- DELIVERY TRACKING ---
  const startTracking = (orderId) => { 
    setIsTracking(true);
    setIsDelivered(false);
    setCurrentOrderId(orderId);
    setStatus('✅ Order Placed! Waiting for kitchen to accept...');
    setOrderRequestFlow({
      customerPlaced: true,
      restaurantAccepted: false,
      riderAssigned: false,
      riderName: null,
      restaurantName: null
    });
    
    console.log(`🔗 Starting tracking for order: ${orderId}`);
    
    // 🚨 Poll backend for order status every 5 seconds as backup
    const pollInterval = setInterval(async () => {
      const orderData = await apiService.getOrderStatus(orderId);
      if (!orderData) return;
      
      console.log(`📊 Polled order status: ${orderData.status}`);
      
      if (orderData.status === 'accepted' || orderData.status === 'preparing') {
        setOrderRequestFlow(prev => ({ ...prev, restaurantAccepted: true }));
        setStatus(orderData.status === 'preparing' ? '👨🍳 Your food is being prepared!' : '✅ Restaurant accepted your order!');
      }
      if (orderData.status === 'ready') {
        setOrderRequestFlow(prev => ({ ...prev, restaurantAccepted: true }));
        setStatus('✅ Your food is ready! Looking for a rider...');
      }
      if (orderData.status === 'assigned' || orderData.status === 'in_delivery') {
        setOrderRequestFlow(prev => ({ ...prev, restaurantAccepted: true, riderAssigned: true, riderName: orderData.rider_id ? `Rider ${orderData.rider_id.substring(0, 6)}` : 'Rider' }));
        setStatus(orderData.status === 'in_delivery' ? '🚀 Rider is on the way with your food!' : '🛵 Rider found! Picking up your order...');
      }
      if (orderData.status === 'delivered') {
        setStatus('🎉 FOOD DELIVERED!');
        setIsDelivered(true);
        clearInterval(pollInterval);
        try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch(e) {}
      }
    }, 5000);
    
    // Store interval ref for cleanup
    return () => clearInterval(pollInterval);
  };
    // =========================================================================
    // RENDER: TRACKING SCREEN
    // =========================================================================
    if (isTracking) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
          <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-emerald-400">Live Tracking</h2>
              <div className={`text-xs px-3 py-1 rounded-full font-bold ${wsStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400' : wsStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-400' : 'bg-slate-600/20 text-slate-400 border border-slate-600'}`}>
                {wsStatus === 'connected' ? '🟢 Connected' : wsStatus === 'error' ? '🔴 Retrying...' : '🟡 Connecting...'}
              </div>
            </div>
            
            <p className="font-mono text-lg text-emerald-300 animate-pulse mb-8 min-h-6">{status}</p>
            
            {/* 🚨 NEW: REQUEST FLOW VISUALIZATION */}
            <div className="bg-slate-800/50 p-6 rounded-2xl mb-8 border border-slate-700">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Order Status Flow</p>
              <div className="flex items-center justify-between">
                {/* Step 1: Order Placed */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-2 transition ${
                    orderRequestFlow.customerPlaced 
                      ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400' 
                      : 'bg-slate-700 text-slate-400 border-2 border-slate-700'
                  }`}>
                    📦
                  </div>
                  <p className="text-xs font-semibold text-center">You Ordered</p>
                </div>
                
                {/* Connector */}
                <div className={`flex-1 h-1 mx-2 transition ${orderRequestFlow.restaurantAccepted ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                
                {/* Step 2: Restaurant Accepted */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-2 transition ${
                    orderRequestFlow.restaurantAccepted 
                      ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400' 
                      : 'bg-slate-700 text-slate-400 border-2 border-slate-700'
                  }`}>
                    👨‍🍳
                  </div>
                  <p className="text-xs font-semibold text-center">Restaurant</p>
                  {orderRequestFlow.restaurantAccepted && (
                    <p className="text-xs text-emerald-400 mt-1 font-bold">{orderRequestFlow.restaurantName}</p>
                  )}
                </div>
                
                {/* Connector */}
                <div className={`flex-1 h-1 mx-2 transition ${orderRequestFlow.riderAssigned ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                
                {/* Step 3: Rider Assigned */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mb-2 transition ${
                    orderRequestFlow.riderAssigned 
                      ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400' 
                      : 'bg-slate-700 text-slate-400 border-2 border-slate-700'
                  }`}>
                    🛵
                  </div>
                  <p className="text-xs font-semibold text-center">Rider Found</p>
                  {orderRequestFlow.riderAssigned && (
                    <p className="text-xs text-emerald-400 mt-1 font-bold">{orderRequestFlow.riderName}</p>
                  )}
                </div>
              </div>
            </div>
            
            {!isDelivered ? (
               <div className="w-full h-[400px] bg-slate-800 rounded-3xl overflow-hidden border border-emerald-500/30 relative">
                  {orderRequestFlow.riderAssigned ? (
                    <MapContainer center={[12.9716, 77.5946]} zoom={14} className="w-full h-full" zoomControl={false}>
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">Carto</a>'
                      />
                      {/* Customer Location (Destination) */}
                      <Marker position={[12.9716, 77.5946]} icon={new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/1008/1008064.png', iconSize: [30, 30] })} />
                      
                      {/* Restaurant Location (Origin) */}
                      <Marker position={[12.9816, 77.5846]} icon={new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png', iconSize: [30, 30] })} />
                      
                      {/* Route Polyline */}
                      <Polyline positions={[[12.9816, 77.5846], [12.9766, 77.5896], [12.9716, 77.5946]]} color="#34d399" weight={4} dashArray="10, 10" />
                      
                      {/* Moving Rider (Simulated for Zomato-like feel) */}
                      <Marker position={riderLocation || [12.9816, 77.5846]} icon={bikeIcon} />
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <p className="text-slate-400 mb-4 font-bold tracking-widest uppercase text-sm">
                        ⏳ Waiting for GPS Ping...
                      </p>
                      <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                    </div>
                  )}
               </div>
            ) : (
              <div className="mt-4 text-center bg-slate-800/40 p-10 rounded-3xl border border-emerald-500/30">
                <h3 className="text-3xl font-bold text-white mb-3">🎉 Delivery Complete!</h3>
                <button 
                  onClick={() => setIsTracking(false)} 
                  className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-6 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition"
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }
  
    // =========================================================================
    // 🚨 RENDER: RESTAURANT MENU VIEW (NEW!)
    // =========================================================================
    if (selectedRestaurant) {
      return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans relative pb-24">
          {/* Header Image */}
          <div className="h-64 w-full relative">
            <img src={selectedRestaurant.img || selectedRestaurant.image_url} alt={selectedRestaurant.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent"></div>
            <button onClick={() => setSelectedRestaurant(null)} className="absolute top-6 left-4 bg-black/50 p-2 rounded-full backdrop-blur-md">
               ← Back
            </button>
          </div>
          
          <div className="px-4 -mt-10 relative z-10 max-w-2xl mx-auto">
            <h1 className="text-4xl font-black mb-2 drop-shadow-lg">{selectedRestaurant.name}</h1>
            <p className="text-slate-400 mb-6">{selectedRestaurant.tags || "Delicious food delivered fast."}</p>
            
            <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2">Recommended</h2>
            
            <div className="flex flex-col gap-6">
              {restaurantMenu.map(item => {
                const cartItem = cart.find(c => c.id === item.id);
                return (
                  <div key={item.id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex gap-4">
                      {item.image_url && <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover" />}
                      <div>
                        <h3 className="font-bold text-lg">{item.name}</h3>
                        <p className="text-emerald-400 font-bold">₹{item.price}</p>
                        <p className="text-slate-500 text-sm mt-1">{item.category}</p>
                      </div>
                    </div>
                    
                    {/* Add / Remove Buttons */}
                    <div className="bg-slate-800 rounded-lg flex items-center border border-emerald-500/30 overflow-hidden">
                      {cartItem ? (
                        <>
                          <button onClick={() => removeFromCart(item.id)} className="px-3 py-2 text-emerald-400 hover:bg-slate-700 font-bold">-</button>
                          <span className="px-2 font-bold text-white">{cartItem.quantity}</span>
                          <button onClick={() => addToCart(item)} className="px-3 py-2 text-emerald-400 hover:bg-slate-700 font-bold">+</button>
                        </>
                      ) : (
                        <button onClick={() => addToCart(item)} className="px-6 py-2 text-emerald-400 font-bold hover:bg-slate-700">ADD</button>
                      )}
                    </div>
                  </div>
                )
              })}
              {restaurantMenu.length === 0 && <p className="text-slate-500 py-10 text-center">This kitchen hasn't added a menu yet.</p>}
            </div>
          </div>
          {/* 🚨 FLOATING CHECKOUT BAR */}
          {cart.length > 0 && !splitRoomMode && (
            <div className="fixed bottom-0 left-0 w-full p-4 bg-slate-900/90 backdrop-blur-xl border-t border-white/10 z-50">
              <div className="max-w-2xl mx-auto flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{cart.reduce((a,b)=>a+b.quantity,0)} Items</p>
                  <p className="text-2xl font-black text-white">₹{cartTotal}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSplitRoomMode(true)} className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold py-3 px-6 rounded-xl transition">
                    Split Bill 👥
                  </button>
                  <button onClick={checkoutCart} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/20 transition transform hover:scale-105">
                    Checkout Solo →
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* 🚨 SPLIT BILL ROOM MODAL (API DRIVEN) */}
          {splitRoomMode && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
                <button onClick={() => { setSplitRoomMode(false); setRoomState('idle'); }} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                
                {roomState === 'idle' && (
                  <div className="text-center py-4">
                    <h2 className="text-2xl font-black text-white mb-2">Split Bill 🍕</h2>
                    <p className="text-sm text-slate-400 mb-8">Share the cost of this order with friends.</p>
                    <div className="flex flex-col gap-4">
                      <button onClick={() => setRoomState('create')} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition">
                        Create Private Room
                      </button>
                      <button onClick={() => setRoomState('join')} className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold py-4 rounded-xl transition">
                        Join Existing Room
                      </button>
                    </div>
                  </div>
                )}

                {roomState === 'create' && (
                  <div className="py-2">
                    <h2 className="text-2xl font-black text-white mb-2">Create Room</h2>
                    <p className="text-sm text-slate-400 mb-6">Set a 4-digit PIN to secure your private split bill room.</p>
                    <input 
                      type="text" 
                      placeholder="Enter 4-Digit PIN" 
                      value={roomPin} 
                      onChange={(e) => setRoomPin(e.target.value)} 
                      maxLength={4}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500 text-center text-2xl tracking-[0.5em] mb-6 font-black"
                    />
                    <button onClick={handleCreateRoom} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition shadow-lg shadow-emerald-500/20">
                      Generate Room Code →
                    </button>
                  </div>
                )}

                {roomState === 'join' && (
                  <div className="py-2">
                    <h2 className="text-2xl font-black text-white mb-2">Join Room</h2>
                    <p className="text-sm text-slate-400 mb-6">Enter the Host's Room Code and PIN.</p>
                    <input 
                      type="text" 
                      placeholder="Room Code (e.g. LB-XXXX)" 
                      value={joinCode} 
                      onChange={(e) => setJoinCode(e.target.value)} 
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500 text-center text-xl mb-4 uppercase font-mono"
                    />
                    <input 
                      type="text" 
                      placeholder="4-Digit PIN" 
                      value={roomPin} 
                      onChange={(e) => setRoomPin(e.target.value)} 
                      maxLength={4}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500 text-center text-2xl tracking-[0.5em] mb-6 font-black"
                    />
                    <button onClick={handleJoinRoom} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition shadow-lg shadow-emerald-500/20">
                      Join Room →
                    </button>
                  </div>
                )}

                {roomState === 'active' && roomDetails && (
                  <div>
                    <h2 className="text-2xl font-black text-white mb-2">Split Bill Room 🍕</h2>
                    <p className="text-sm text-slate-400 mb-6">Share this code & PIN with friends.</p>
                    
                    <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-between mb-6 border border-emerald-500/30">
                      <div>
                        <p className="text-xs text-emerald-400 font-bold uppercase">Room Code</p>
                        <p className="text-2xl font-mono tracking-widest text-white">{roomDetails.room_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-amber-400 font-bold uppercase">Secret PIN</p>
                        <p className="text-2xl font-mono tracking-widest text-white">{roomPin}</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4 mb-6">
                      <div className="flex justify-between text-sm text-slate-400 mb-1">
                        <span>Subtotal</span>
                        <span>₹{cartTotal}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-400 mb-1">
                        <span>Delivery Partner Fee</span>
                        <span>₹{deliveryFee}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-400 mb-3">
                        <span>GST (5%)</span>
                        <span>₹{(cartTotal * gstRate).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-black text-xl text-white">
                        <span>Grand Total</span>
                        <span>₹{(cartTotal + deliveryFee + (cartTotal * gstRate)).toFixed(2)}</span>
                      </div>
                    </div>

                    <button onClick={() => {
                       setSplitRoomMode(false);
                       setRoomState('idle');
                       checkoutCart();
                    }} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition shadow-lg shadow-emerald-500/20">
                      {roomDetails.isHost ? 'Confirm & Pay All →' : 'Pay My Share →'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
  
    // =========================================================================
    // RENDER: DISCOVERY FEED (HOME) - WITH TABS FOR HISTORY & FAVORITES
    // =========================================================================
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-sans overflow-x-hidden">
        <div className="w-full max-w-2xl mx-auto bg-slate-900 min-h-screen shadow-2xl relative">
          
          {/* HEADER & SEARCH */}
          <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-md pt-6 pb-4 px-4 border-b border-white/5">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={goBack}>
                <span className="text-emerald-500 text-2xl">📍</span>
                <div>
                  <h3 className="font-bold text-lg leading-tight flex items-center gap-1">Home <span className="text-xs">▼</span></h3>
                  <p className="text-xs text-slate-400 truncate w-48">Near Current Location</p>
                </div>
              </div>
            </div>
            
            {/* 🚨 NEW: VIEW MODE TABS */}
            <div className="flex gap-2 mb-4 border-b border-white/10 pb-3">
              <button 
                onClick={() => setViewMode('home')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${viewMode === 'home' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                🏠 Explore
              </button>
              <button 
                onClick={() => setViewMode('history')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${viewMode === 'history' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                📋 Orders ({orderHistory.length})
              </button>
              <button 
                onClick={() => setViewMode('favorites')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition ${viewMode === 'favorites' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                ⭐ Favorites ({favoriteRestaurants.length})
              </button>
            </div>
            
            <div className="relative">
              <span className="absolute left-4 top-3 text-slate-400">🔍</span>
              <input 
                type="text" 
                value={vibeQuery}
                onChange={(e) => setVibeQuery(e.target.value)}
                onKeyDown={handleVibeSearch}
                placeholder="Type your craving & budget..." 
                className="w-full bg-slate-800 text-white rounded-xl py-3 pl-12 pr-4 outline-none focus:ring-1 focus:ring-emerald-500" 
              />
            </div>
          </div>
  
          {status && <div className="px-4 py-2 text-center text-rose-400 text-sm font-bold bg-rose-500/10">{status}</div>}
  
          {/* --- ORDER HISTORY VIEW --- */}
          {viewMode === 'history' && (
            <div className="py-6 px-4 pb-24">
              <h2 className="text-xl font-bold mb-6">Your Order History</h2>
              {orderHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg">No orders yet</p>
                  <p className="text-slate-500 text-sm mt-2">Place your first order to get started!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orderHistory.map((order) => (
                    <div key={order.id} className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-white">{order.restaurant?.name || 'Restaurant'}</p>
                          <p className="text-xs text-slate-400 mt-1">{new Date(order.timestamp).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                      <p className="text-emerald-400 font-bold mt-2">₹{order.total}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
  
          {/* --- FAVORITES VIEW --- */}
          {viewMode === 'favorites' && (
            <div className="py-6 px-4 pb-24">
              <h2 className="text-xl font-bold mb-6">Your Favorites</h2>
              {favoriteRestaurants.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-lg">No favorites yet</p>
                  <p className="text-slate-500 text-sm mt-2">Order from restaurants to add them here!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {favoriteRestaurants.map((rest) => (
                    <div key={rest.id} onClick={() => openMenu(rest)} className="group cursor-pointer">
                      <div className="w-full h-56 rounded-2xl overflow-hidden relative shadow-lg mb-3">
                        <img src={rest.img || rest.image_url} alt={rest.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/90 to-transparent"></div>
                        <div className="absolute bottom-3 left-3 text-white">
                           <p className="font-extrabold text-2xl">Explore Menu</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-start px-1">
                        <div>
                          <h3 className="text-xl font-bold text-slate-100">{rest.name}</h3>
                          <p className="text-sm text-slate-400 mt-0.5">{rest.tags || 'Local Kitchen'}</p>
                        </div>
                        <div className="bg-green-700 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                          {rest.rating} <span>★</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
  
          {/* AI TIE-BREAKER SHOWDOWN */}
          {aiDecision && viewMode === 'home' && (
            <div className="p-4 animate-fade-in">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🤖</span>
                  <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">Anti-Paralysis Engine</span>
                </div>
                <p className="text-slate-200 text-base font-medium mb-6 p-4 bg-emerald-950/40 rounded-2xl border border-emerald-500/10">"{aiDecision.verdict}"</p>
                
                {aiDecision.has_split_decision && (
                  <div className="grid grid-cols-2 gap-4 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold z-10">VS</div>
                    {/* 🚨 WIRED TO openMenu() */}
                    <div onClick={() => openMenu(aiDecision.contender_a)} className="p-4 rounded-2xl cursor-pointer border bg-slate-900 border-white/5 hover:border-emerald-500/50 transition">
                      <h4 className="font-bold text-white truncate">{aiDecision.contender_a.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">⭐ {aiDecision.contender_a.rating}</p>
                    </div>
                    <div onClick={() => openMenu(aiDecision.contender_b)} className="p-4 rounded-2xl cursor-pointer border bg-slate-900 border-white/5 hover:border-emerald-500/50 transition">
                      <h4 className="font-bold text-white truncate">{aiDecision.contender_b.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">⭐ {aiDecision.contender_b.rating}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
  
          {/* MAIN LIVE RESTAURANT FEED */}
          {!aiDecision && viewMode === 'home' && (
            <div className="py-6 px-4 pb-24">
              <h2 className="text-xl font-bold mb-6">Top restaurants for you</h2>
              <div className="flex flex-col gap-8">
                {restaurants.map((rest) => (
                  // 🚨 WIRED TO openMenu()
                  <div key={rest.id} onClick={() => openMenu(rest)} className="group cursor-pointer">
                    <div className="w-full h-56 rounded-2xl overflow-hidden relative shadow-lg mb-3">
                      <img src={rest.img || rest.image_url} alt={rest.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/90 to-transparent"></div>
                      <div className="absolute bottom-3 left-3 text-white">
                         <p className="font-extrabold text-2xl">Explore Menu</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-start px-1">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100">{rest.name}</h3>
                        <p className="text-sm text-slate-400 mt-0.5">{rest.tags || 'Local Kitchen'}</p>
                      </div>
                      <div className="bg-green-700 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        {rest.rating} <span>★</span>
                      </div>
                    </div>
                  </div>
                ))}
                {restaurants.length === 0 && <p className="text-slate-500 text-center py-10">Loading local kitchens...</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
}