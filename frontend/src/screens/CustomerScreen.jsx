import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';

// ─── Icons ───────────────────────────────────────────────────────────────────
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1986/1986937.png',
  iconSize: [40, 40], iconAnchor: [20, 20],
});

// ─── Confetti Utility ─────────────────────────────────────────────────────────
function fireConfetti() {
  try {
    const colors = ['#10b981','#34d399','#6ee7b7','#f59e0b','#fbbf24'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position:fixed; top:50%; left:${Math.random()*100}%;
        width:${6+Math.random()*8}px; height:${6+Math.random()*8}px;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        border-radius:${Math.random()>0.5?'50%':'2px'};
        pointer-events:none; z-index:9999;
        animation: confettiFall ${1.5+Math.random()*2}s ease-in forwards;
        transform: rotate(${Math.random()*360}deg);
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }
    const style = document.createElement('style');
    style.textContent = `@keyframes confettiFall { from { transform: translateY(-100px) rotate(0deg); opacity:1; } to { transform: translateY(100vh) rotate(${Math.random()*720}deg); opacity:0; } }`;
    document.head.appendChild(style);
  } catch(e) {}
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function RestaurantSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="skeleton w-full h-56 rounded-2xl mb-3" />
      <div className="flex justify-between items-start px-1">
        <div className="flex-1">
          <div className="skeleton h-5 w-40 mb-2 rounded-lg" />
          <div className="skeleton h-3 w-28 rounded-lg" />
        </div>
        <div className="skeleton h-7 w-12 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Category Data ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'All',      icon: '🏠', tag: null },
  { name: 'Biryani',  icon: '🥘', tag: 'biryani' },
  { name: 'Pizza',    icon: '🍕', tag: 'pizza' },
  { name: 'Burger',   icon: '🍔', tag: 'burger' },
  { name: 'Healthy',  icon: '🥗', tag: 'healthy' },
  { name: 'Dessert',  icon: '🍰', tag: 'dessert' },
  { name: 'Coffee',   icon: '☕', tag: 'coffee' },
  { name: 'Sushi',    icon: '🍱', tag: 'sushi' },
];

// ─── Hero Banner Slides ───────────────────────────────────────────────────────
const HERO_SLIDES = [
  { bg: 'from-emerald-900/80 to-slate-900/90', emoji: '🚀', label: 'FREE DELIVERY', title: 'Order above ₹199', sub: 'No delivery charges on your first 5 orders', tag: 'LIMITED' },
  { bg: 'from-amber-900/80 to-slate-900/90',   emoji: '⚡', label: 'LIGHTNING FAST', title: 'Under 15 Minutes', sub: 'AI-optimized routing for speed delivery', tag: 'GUARANTEED' },
  { bg: 'from-violet-900/80 to-slate-900/90',  emoji: '🤖', label: 'AI PICKS FOR YOU', title: 'Tell Us Your Vibe', sub: 'Type a mood, we find the perfect restaurant', tag: 'NEW' },
];

// ─── Delivery helpers (computed from API data) ───────────────────────────────
function getDiscount(idx) { const d=[null,'20% OFF','FREE DELIVERY',null,'₹30 OFF',null,'TRENDING']; return d[idx % d.length]; }

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomerScreen({ goBack, addGlobalOrder, currentCustomerId: propCustomerId, userEmail }) {
  // ── Persistent ID ──
  const [currentCustomerId] = useState(() => {
    if (propCustomerId) return propCustomerId;
    const stored = localStorage.getItem('localbite_customer_id');
    if (stored) return stored;
    const newId = 'customer_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('localbite_customer_id', newId);
    return newId;
  });

  // ── Feed States ──
  const [restaurants, setRestaurants] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [dynamicCategories, setDynamicCategories] = useState(CATEGORIES);
  const [viewMode, setViewMode] = useState('home'); // 'home'|'history'|'favorites'|'profile'

  // ── Hero Carousel ──
  const [heroSlide, setHeroSlide] = useState(0);
  const heroTimer = useRef(null);

  // ── Menu & Cart ──
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantMenu, setRestaurantMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [activeMenuCat, setActiveMenuCat] = useState('All');
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // ── Order History / Favorites ──
  const [orderHistory, setOrderHistory] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(() => JSON.parse(localStorage.getItem('lb_fav_ids') || '[]'));

  // ── Tracking ──
  const [isTracking, setIsTracking] = useState(false);
  const [status, setStatus] = useState('');
  const [riderLocation, setRiderLocation] = useState(null);
  const [isDelivered, setIsDelivered] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [orderFlow, setOrderFlow] = useState({ customerPlaced: true, restaurantAccepted: false, riderAssigned: false, riderName: null, restaurantName: null });
  const [etaSeconds, setEtaSeconds] = useState(900);
  const wsRef = useRef(null);

  // ── Post-Delivery Rating ──
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // ── AI Search ──
  const [vibeQuery, setVibeQuery] = useState('');
  const [aiDecision, setAiDecision] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Split Bill ──
  const [splitRoomMode, setSplitRoomMode] = useState(false);
  const [roomState, setRoomState] = useState('idle'); // 'idle'|'create'|'join'|'active'
  const [roomPin, setRoomPin] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomDetails, setRoomDetails] = useState(null); // full room summary from API
  const [splitDisplayName, setSplitDisplayName] = useState('');
  const [splitError, setSplitError] = useState('');
  const splitPollRef = useRef(null);
  const splitRoomCodeRef = useRef(''); // stable ref to avoid stale closure in interval
  const [splitOrderSnapshot, setSplitOrderSnapshot] = useState(null); // captured before placing group order
  const [isGroupOrder, setIsGroupOrder] = useState(false); // true when tracking a group order

  // ── Profile Drawer ──
  const [showProfile, setShowProfile] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState(() => JSON.parse(localStorage.getItem('lb_addresses') || '[]'));
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  const deliveryFee = 40;
  const gstRate = 0.05;
  const promoDiscount = promoApplied ? Math.round(cartTotal * 0.1) : 0;

  // ── Computed ──
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const menuCategories = ['All', ...new Set(restaurantMenu.map(i => i.category).filter(Boolean))];
  const filteredMenu = activeMenuCat === 'All' ? restaurantMenu : restaurantMenu.filter(i => i.category === activeMenuCat);
  // Build category chips dynamically from real restaurant data
  const allApiCategories = [...new Set(restaurants.flatMap(r => r.all_categories || []))]
    .filter(Boolean)
    .map(c => ({ name: c, icon: CATEGORIES.find(cat => cat.tag === c.toLowerCase())?.icon || '🍽️', tag: c.toLowerCase() }));
  const categoriesWithAll = [CATEGORIES[0], ...allApiCategories];

  const filteredRestaurants = activeCategory
    ? restaurants.filter(r => {
        const cats = (r.all_categories || []).map(c => c.toLowerCase());
        const tag = (r.tags || r.category || '').toLowerCase();
        return cats.some(c => c.includes(activeCategory)) || tag.includes(activeCategory);
      })
    : restaurants;
  const favoriteRestaurants = restaurants.filter(r => favoriteIds.includes(r.id));

  // ── Effects ──────────────────────────────────────────────────────────────
  // Hero carousel
  useEffect(() => {
    heroTimer.current = setInterval(() => setHeroSlide(s => (s + 1) % HERO_SLIDES.length), 4000);
    return () => clearInterval(heroTimer.current);
  }, []);

  // Load restaurants
  useEffect(() => {
    setFeedLoading(true);
    fetch('http://127.0.0.1:8000/api/v1/customer/restaurants')
      .then(r => r.json())
      .then(d => setRestaurants(d))
      .catch(() => {})
      .finally(() => setFeedLoading(false));

    // Load real order history from DB
    apiService.getOrderHistory(currentCustomerId).then(orders => setOrderHistory(orders)).catch(() => {});
    const saved = localStorage.getItem('lb_addresses');
    if (saved) setSavedAddresses(JSON.parse(saved));
  }, [currentCustomerId]);

  // WebSocket
  useEffect(() => {
    wsRef.current = apiService.connectCustomerWS(currentCustomerId, (data) => {
      if (data.type === 'order_accepted' || data.type === 'order_preparing') {
        setOrderFlow(p => ({ ...p, restaurantAccepted: true, restaurantName: data.restaurant_name || 'Restaurant' }));
        setStatus(data.type === 'order_accepted' ? `✅ Accepted by ${data.restaurant_name || 'Restaurant'}!` : '👨‍🍳 Food is being prepared!');
      }
      if (data.type === 'rider_assigned') {
        setOrderFlow(p => ({ ...p, riderAssigned: true, riderName: data.rider_name || 'Rider' }));
        setStatus(`🛵 ${data.rider_name || 'Rider'} is on the way!`);
      }
      if (data.type === 'delivery_complete' || data.type === 'delivered') {
        setStatus('🎉 FOOD DELIVERED!');
        setIsDelivered(true);
        fireConfetti();
        setTimeout(() => { setShowRatingModal(true); }, 800);
      }
    }, s => setWsStatus(s));
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [currentCustomerId]);

  // Rider animation
  useEffect(() => {
    if (!orderFlow.riderAssigned || isDelivered) return;
    setRiderLocation([12.9816, 77.5846]);
    const path = [[12.9816, 77.5846],[12.9791, 77.5871],[12.9766, 77.5896],[12.9741, 77.5921],[12.9716, 77.5946]];
    let step = 0;
    const iv = setInterval(() => {
      if (step < path.length - 1) { step++; setRiderLocation(path[step]); }
      else clearInterval(iv);
    }, 4000);
    return () => clearInterval(iv);
  }, [orderFlow.riderAssigned, isDelivered]);

  // ETA countdown
  useEffect(() => {
    if (!isTracking || isDelivered) return;
    const iv = setInterval(() => setEtaSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [isTracking, isDelivered]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleFavorite = (restId) => {
    setFavoriteIds(prev => {
      const next = prev.includes(restId) ? prev.filter(id => id !== restId) : [...prev, restId];
      localStorage.setItem('lb_fav_ids', JSON.stringify(next));
      return next;
    });
  };

  const handleVibeSearch = async (e) => {
    if (e.key !== 'Enter' || !vibeQuery.trim()) return;
    setSearchLoading(true); setAiDecision(null);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/customer/vibe-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: vibeQuery })
      });
      if (res.ok) setAiDecision(await res.json());
      else { setStatus('❌ No matching restaurants found.'); setTimeout(() => setStatus(''), 3000); }
    } catch { setStatus('❌ AI Engine offline.'); setTimeout(() => setStatus(''), 3000); }
    setSearchLoading(false);
  };

  const openMenu = async (restaurant) => {
    setSelectedRestaurant(restaurant); setCart([]); setActiveMenuCat('All');
    setMenuLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/partners/restaurant/${restaurant.id}/menu`);
      if (res.ok) setRestaurantMenu(await res.json());
    } catch {}
    setMenuLoading(false);
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      return existing ? prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === itemId);
      return ex?.quantity === 1 ? prev.filter(i => i.id !== itemId) : prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const applyPromo = () => {
    if (promoCode.toUpperCase() === 'LOCALBITE10') { setPromoApplied(true); }
    else { setPromoCode(''); }
  };

  const checkoutCart = async () => {
    if (!cart.length) return;
    setShowCartDrawer(false);
    setStatus(`⏳ Sending order to ${selectedRestaurant.name}...`);
    const itemDescription = cart.map(c => `${c.quantity}x ${c.name}`).join(', ');
    const currentRestId = selectedRestaurant.id;
    const currentRestName = selectedRestaurant.name;
    const grandTotal = Math.max(0, cartTotal + deliveryFee + Math.round(cartTotal * gstRate) - promoDiscount);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/orders/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: userEmail || 'Customer',
          delivery_address: savedAddresses[0] || 'Current Location',
          item_description: itemDescription,
          amount: grandTotal,
          volume_units: cart.reduce((s, i) => s + i.quantity * 10, 0),
          restaurant_id: currentRestId,
          customer_id: currentCustomerId,
        })
      });
      if (response.ok) {
        const created = await response.json();
        if (addGlobalOrder) addGlobalOrder({ id: created.id, status: 'new', items: itemDescription, item_description: itemDescription, total: `₹${grandTotal}`, amount: grandTotal, time: 'Just now', kitchen: currentRestName, restaurant_name: currentRestName, restaurant_id: currentRestId, delivery_address: savedAddresses[0] || 'Current Location' });
        // Refresh order history from DB after placing order
        apiService.getOrderHistory(currentCustomerId).then(orders => setOrderHistory(orders)).catch(() => {});
        setCart([]); setSelectedRestaurant(null); setPromoApplied(false); setPromoCode('');
        startTracking(created.id, currentRestId);
      } else { setStatus('❌ Failed to place order.'); }
    } catch { setStatus('❌ Connection issue.'); }
  };

  const reorderItems = (order) => {
    if (order.restaurant) {
      openMenu(order.restaurant).then(() => {
        if (Array.isArray(order.items)) order.items.forEach(item => addToCart(item));
      });
    }
    setViewMode('home');
  };

  const startTracking = (orderId, restaurantId) => {
    setIsTracking(true); setIsDelivered(false); setCurrentOrderId(orderId); setEtaSeconds(900);
    setStatus('✅ Order Placed! Waiting for kitchen...');
    setOrderFlow({ customerPlaced: true, restaurantAccepted: false, riderAssigned: false, riderName: null, restaurantName: null, restaurantId });
    const pollInterval = setInterval(async () => {
      const orderData = await apiService.getOrderStatus(orderId);
      if (!orderData) return;
      if (orderData.status === 'accepted' || orderData.status === 'preparing') {
        setOrderFlow(p => ({ ...p, restaurantAccepted: true }));
        setStatus(orderData.status === 'preparing' ? '👨‍🍳 Food is being prepared!' : '✅ Restaurant accepted!');
      }
      if (orderData.status === 'assigned' || orderData.status === 'in_delivery') {
        setOrderFlow(p => ({ ...p, restaurantAccepted: true, riderAssigned: true, riderName: orderData.rider_id ? `Rider ${orderData.rider_id.substring(0, 6)}` : 'Rider' }));
        setStatus('🛵 Rider is on the way!');
      }
      if (orderData.status === 'delivered') {
        setStatus('🎉 FOOD DELIVERED!'); setIsDelivered(true); clearInterval(pollInterval);
        fireConfetti();
        setTimeout(() => setShowRatingModal(true), 800);
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  };

  // Real rating submission to backend
  const submitRating = async () => {
    if (!rating) return;
    await apiService.rateOrder(currentOrderId, rating, ratingFeedback, orderFlow.restaurantId);
    setRatingSubmitted(true);
    // Refresh restaurant feed so rating updates show
    fetch('http://127.0.0.1:8000/api/v1/customer/restaurants')
      .then(r => r.json()).then(d => setRestaurants(d)).catch(() => {});
    setTimeout(() => { setShowRatingModal(false); setIsTracking(false); }, 1500);
  };

  // ── Split Bill Polling ──
  const startRoomPolling = useCallback((roomCode) => {
    splitRoomCodeRef.current = roomCode;
    if (splitPollRef.current) clearInterval(splitPollRef.current);
    splitPollRef.current = setInterval(async () => {
      if (!splitRoomCodeRef.current) return;
      try {
        const res = await fetch(`http://localhost:8000/api/v1/split/room/${splitRoomCodeRef.current}?user_id=${currentCustomerId}`);
        if (res.ok) {
          const data = await res.json();
          setRoomDetails(data);
        }
      } catch {}
    }, 3000);
  }, [currentCustomerId]);

  const stopRoomPolling = useCallback(() => {
    if (splitPollRef.current) { clearInterval(splitPollRef.current); splitPollRef.current = null; }
    splitRoomCodeRef.current = '';
  }, []);

  // Clean up polling on unmount
  useEffect(() => { return () => stopRoomPolling(); }, [stopRoomPolling]);

  const handleCreateRoom = async () => {
    if (!roomPin || roomPin.length < 4) { setSplitError('PIN must be at least 4 digits.'); return; }
    setSplitError('');
    const displayName = splitDisplayName.trim() || userEmail?.split('@')[0] || 'Host';
    const cartItems = cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
    try {
      const res = await fetch('http://localhost:8000/api/v1/split/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: currentCustomerId, room_pin: roomPin, display_name: displayName, cart_total: cartTotal, cart_items: cartItems })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRoomDetails(data);
      setRoomState('active');
      startRoomPolling(data.room_code);
    } catch { setSplitError('Could not create room. Please try again.'); }
  };

  const handleJoinRoom = async () => {
    if (!joinCode || !roomPin) { setSplitError('Enter room code and PIN.'); return; }
    setSplitError('');
    const displayName = splitDisplayName.trim() || userEmail?.split('@')[0] || 'Guest';
    const cartItems = cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
    try {
      const res = await fetch('http://localhost:8000/api/v1/split/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentCustomerId, room_code: joinCode.toUpperCase(), room_pin: roomPin, display_name: displayName, cart_total: cartTotal, cart_items: cartItems })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Invalid'); }
      const data = await res.json();
      setRoomDetails(data);
      setRoomState('active');
      startRoomPolling(data.room_code);
    } catch (err) { setSplitError(err.message || 'Invalid code or PIN.'); }
  };

  const handleUpdateCost = async (roomCode) => {
    if (!roomCode) return;
    const cartItems = cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
    try {
      await fetch(`http://localhost:8000/api/v1/split/room/${roomCode}/update-cost`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentCustomerId, cart_total: cartTotal, cart_items: cartItems })
      });
    } catch {}
  };

  const handleSetReady = async (roomCode, isReady) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/split/room/${roomCode}/ready`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentCustomerId, is_ready: isReady })
      });
      if (res.ok) setRoomDetails(await res.json());
    } catch {}
  };

  const handlePollMembers = async (roomCode) => {
    try {
      await fetch(`http://localhost:8000/api/v1/split/room/${roomCode}/poll`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: currentCustomerId })
      });
    } catch {}
  };

  const handleLeaveRoom = async () => {
    stopRoomPolling();
    // Only host can close room; only close if order hasn't been placed yet
    if (roomDetails?.room_code && roomDetails?.is_host && !roomDetails?.order_placed) {
      try {
        await fetch(`http://localhost:8000/api/v1/split/room/${roomDetails.room_code}/close`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host_id: currentCustomerId })
        });
      } catch {}
    }
    setSplitRoomMode(false); setRoomState('idle'); setRoomDetails(null); setRoomPin(''); setJoinCode(''); setSplitDisplayName(''); setSplitError('');
  };

  // ── Group Checkout: sends combined items + full group total ──
  const checkoutGroupCart = async (snapshot) => {
    if (!cart.length || !selectedRestaurant) return;
    setShowCartDrawer(false);
    const currentRestId = selectedRestaurant.id;
    const currentRestName = selectedRestaurant.name;

    // Build combined item description from all members
    const combinedDesc = snapshot.members
      .map(m => {
        const items = (m.cart_items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
        return items ? `[${m.display_name}] ${items}` : '';
      })
      .filter(Boolean)
      .join(' | ');

    const itemDescription = `[GROUP ORDER ×${snapshot.memberCount}] ${combinedDesc}`;
    const grandTotal = snapshot.grandTotal;

    setStatus(`⏳ Placing group order with ${currentRestName}...`);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/orders/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: userEmail || 'Customer',
          delivery_address: savedAddresses[0] || 'Current Location',
          item_description: itemDescription,
          amount: grandTotal,
          volume_units: cart.reduce((s, i) => s + i.quantity * 10, 0),
          restaurant_id: currentRestId,
          customer_id: currentCustomerId,
        })
      });
      if (response.ok) {
        const created = await response.json();
        if (addGlobalOrder) addGlobalOrder({ id: created.id, status: 'new', items: itemDescription, item_description: itemDescription, total: `₹${grandTotal}`, amount: grandTotal, time: 'Just now', kitchen: currentRestName, restaurant_name: currentRestName, restaurant_id: currentRestId, delivery_address: savedAddresses[0] || 'Current Location' });
        apiService.getOrderHistory(currentCustomerId).then(orders => setOrderHistory(orders)).catch(() => {});

        // Notify the room that order was placed so guests can see it
        try {
          await fetch(`http://localhost:8000/api/v1/split/room/${snapshot.room_code}/order-placed`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_id: currentCustomerId, order_id: created.id })
          });
        } catch {}

        setCart([]); setSelectedRestaurant(null); setPromoApplied(false); setPromoCode('');
        setIsGroupOrder(true);
        setSplitOrderSnapshot(snapshot);
        startGroupTracking(created.id, currentRestId, snapshot);
      } else { setStatus('❌ Failed to place group order.'); }
    } catch { setStatus('❌ Connection issue.'); }
  };

  // ── Group Tracking: like startTracking but also notifies the room on delivery ──
  const startGroupTracking = (orderId, restaurantId, snapshot) => {
    setIsTracking(true); setIsDelivered(false); setCurrentOrderId(orderId); setEtaSeconds(900);
    setStatus('✅ Group Order Placed! Waiting for kitchen...');
    setOrderFlow({ customerPlaced: true, restaurantAccepted: false, riderAssigned: false, riderName: null, restaurantName: null, restaurantId });
    const pollInterval = setInterval(async () => {
      const orderData = await apiService.getOrderStatus(orderId);
      if (!orderData) return;
      if (orderData.status === 'accepted' || orderData.status === 'preparing') {
        setOrderFlow(p => ({ ...p, restaurantAccepted: true }));
        setStatus(orderData.status === 'preparing' ? '👨‍🍳 Food is being prepared!' : '✅ Restaurant accepted!');
      }
      if (orderData.status === 'assigned' || orderData.status === 'in_delivery') {
        setOrderFlow(p => ({ ...p, restaurantAccepted: true, riderAssigned: true, riderName: orderData.rider_id ? `Rider ${orderData.rider_id.substring(0, 6)}` : 'Rider' }));
        setStatus('🛵 Rider is on the way!');
      }
      if (orderData.status === 'delivered') {
        setStatus('🎉 GROUP ORDER DELIVERED!'); setIsDelivered(true); clearInterval(pollInterval);
        fireConfetti();
        // Notify the room guests that delivery is complete
        try {
          await fetch(`http://localhost:8000/api/v1/split/room/${snapshot.room_code}/delivered`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_id: currentCustomerId })
          });
        } catch {}
        setTimeout(() => setShowRatingModal(true), 800);
      }
    }, 5000);
    return () => clearInterval(pollInterval);
  };

  const handlePlaceGroupOrder = async () => {
    if (!roomDetails?.all_ready) return;

    // Snapshot the full room state BEFORE stopping polling
    const gst = Math.round((roomDetails.total_cart || 0) * gstRate);
    const grandTotal = (roomDetails.total_cart || 0) + deliveryFee + gst;
    const snapshot = {
      room_code: roomDetails.room_code,
      members: roomDetails.members,
      memberCount: roomDetails.member_count,
      totalCart: roomDetails.total_cart,
      grandTotal,
      deliveryFee,
      gst,
    };

    // Close the split bill modal but keep room alive (guests still polling)
    stopRoomPolling();
    setSplitRoomMode(false); setRoomState('idle'); setRoomDetails(null);
    setRoomPin(''); setJoinCode(''); setSplitDisplayName(''); setSplitError('');

    // Use the group checkout (sends full group total + combined description)
    await checkoutGroupCart(snapshot);
  };

  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecondsLeft = etaSeconds % 60;

  // ══════════════════════════════════════════════════════════════════════════
  // ── RENDER: LIVE TRACKING SCREEN ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (isTracking) {
    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">Live Tracking</h2>
              {isGroupOrder && (
                <span className="text-[10px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">👥 Group</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Order #{currentOrderId?.slice(0, 8)}</p>
          </div>
          <div className={`text-xs px-3 py-1.5 rounded-full font-bold border ${wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/30 text-slate-400 border-slate-600/30'}`}>
            {wsStatus === 'connected' ? '🟢 Live' : '🟡 Connecting...'}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {/* ETA Card */}
          {!isDelivered && (
            <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/60 border border-emerald-500/20 rounded-3xl p-6 flex justify-between items-center animate-fade-in">
              <div>
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mb-1">Estimated Arrival</p>
                <p className="text-5xl font-black text-white tabular-nums">
                  {String(etaMinutes).padStart(2,'0')}:{String(etaSecondsLeft).padStart(2,'0')}
                </p>
                <p className="text-slate-400 text-sm mt-1">{status}</p>
              </div>
              <div className="text-6xl opacity-80">{orderFlow.riderAssigned ? '🛵' : orderFlow.restaurantAccepted ? '👨‍🍳' : '📦'}</div>
            </div>
          )}

          {/* Group Order Breakdown Card */}
          {isGroupOrder && splitOrderSnapshot && (
            <div className="bg-violet-900/20 border border-violet-500/20 rounded-3xl p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">👥</span>
                <p className="text-xs font-black text-violet-400 uppercase tracking-widest">Group Order — {splitOrderSnapshot.memberCount} people</p>
              </div>
              <div className="space-y-2 mb-4">
                {splitOrderSnapshot.members?.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                        m.is_host ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>{m.display_name?.[0]?.toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{m.display_name}{m.is_host ? ' (Host)' : ''}</p>
                        <p className="text-[10px] text-slate-500 max-w-[180px] truncate">{(m.cart_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ') || 'No items'}</p>
                      </div>
                    </div>
                    <span className="text-emerald-400 font-black text-sm">₹{m.cart_total?.toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400"><span>Items total</span><span>₹{splitOrderSnapshot.totalCart?.toFixed(0)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Delivery</span><span>₹{splitOrderSnapshot.deliveryFee}</span></div>
                <div className="flex justify-between text-slate-400"><span>GST (5%)</span><span>₹{splitOrderSnapshot.gst}</span></div>
                <div className="flex justify-between font-black text-white text-sm pt-1 border-t border-white/10">
                  <span>Grand Total</span>
                  <span>₹{splitOrderSnapshot.grandTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Order Flow Steps */}
          <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-5">Order Journey</p>
            <div className="flex items-center">
              {[
                { done: orderFlow.customerPlaced, icon: '📦', label: 'You Ordered', sub: 'Confirmed' },
                { done: orderFlow.restaurantAccepted, icon: '👨‍🍳', label: 'Restaurant', sub: orderFlow.restaurantName || 'Pending' },
                { done: orderFlow.riderAssigned, icon: '🛵', label: 'Rider', sub: orderFlow.riderName || 'Finding...' },
                { done: isDelivered, icon: '🏠', label: 'Delivered', sub: isDelivered ? '✓ Done!' : 'Soon' },
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-2 transition-all duration-500 ${step.done ? 'bg-emerald-500/20 border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'bg-slate-700/50 border-2 border-slate-600'}`}>
                      {step.icon}
                    </div>
                    <p className="text-xs font-bold text-center text-slate-300">{step.label}</p>
                    <p className={`text-[10px] mt-0.5 text-center font-semibold ${step.done ? 'text-emerald-400' : 'text-slate-500'}`}>{step.sub}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-all duration-1000 ${arr[i+1].done ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-slate-700'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Rider Info Card (shows when assigned) */}
          {orderFlow.riderAssigned && !isDelivered && (
            <div className="bg-slate-800/40 rounded-2xl p-4 border border-white/5 flex items-center justify-between animate-slide-down">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-xl font-black">
                  {orderFlow.riderName?.[0]?.toUpperCase() || 'R'}
                </div>
                <div>
                  <p className="font-bold text-white">{orderFlow.riderName || 'Rider'}</p>
                  <p className="text-xs text-slate-400">⭐ 4.8 · Electric Scooter</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-lg transition">📞</button>
                <button className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-lg transition">💬</button>
              </div>
            </div>
          )}

          {/* Map */}
          {!isDelivered ? (
            <div className="w-full h-80 bg-slate-800 rounded-3xl overflow-hidden border border-emerald-500/20 relative">
              {orderFlow.riderAssigned ? (
                <MapContainer center={[12.9716, 77.5946]} zoom={14} className="w-full h-full" zoomControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; Carto' />
                  <Marker position={[12.9716, 77.5946]} icon={new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/1008/1008064.png', iconSize: [30, 30] })} />
                  <Marker position={[12.9816, 77.5846]} icon={new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png', iconSize: [30, 30] })} />
                  <Polyline positions={[[12.9816, 77.5846],[12.9766, 77.5896],[12.9716, 77.5946]]} color="#34d399" weight={4} dashArray="10,10" />
                  <Marker position={riderLocation || [12.9816, 77.5846]} icon={bikeIcon} />
                </MapContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
                  </div>
                  <p className="text-slate-400 text-sm font-bold tracking-widest uppercase">Waiting for GPS Ping...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center bg-gradient-to-br from-emerald-900/30 to-slate-900/50 p-10 rounded-3xl border border-emerald-500/20 animate-bounce-in">
              <div className="text-7xl mb-4">🎉</div>
              <h3 className="text-3xl font-black text-white mb-2">Delivered!</h3>
              <p className="text-slate-400 mb-6">Enjoy your meal! Rate your experience below.</p>
              <button onClick={() => { setIsTracking(false); setShowRatingModal(true); }} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-8 rounded-xl transition transform hover:scale-105 shadow-lg shadow-emerald-500/20">
                Rate & Review →
              </button>
            </div>
          )}
        </div>

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="fixed inset-0 z-[200] bg-black/70 drawer-overlay flex items-end justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md animate-slide-up">
              {!ratingSubmitted ? (
                <>
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-3">⭐</div>
                    <h3 className="text-2xl font-black text-white">How was your meal?</h3>
                    <p className="text-slate-400 text-sm mt-1">Your feedback helps improve LocalBite</p>
                  </div>
                  <div className="flex justify-center gap-3 mb-6">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onMouseEnter={() => setHoveredStar(s)} onMouseLeave={() => setHoveredStar(0)} onClick={() => setRating(s)}
                        className={`text-4xl transition-all duration-150 ${s <= (hoveredStar || rating) ? 'text-amber-400 scale-110' : 'text-slate-600'}`}>
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea value={ratingFeedback} onChange={e => setRatingFeedback(e.target.value)} placeholder="Tell us more... (optional)" rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white text-sm outline-none focus:border-emerald-500 transition resize-none mb-4" />
                  <div className="flex gap-3">
                    <button onClick={() => { setShowRatingModal(false); setIsTracking(false); }} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition">Skip</button>
                    <button onClick={submitRating} disabled={!rating}
                      className="flex-2 flex-1 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black hover:bg-emerald-400 transition disabled:opacity-40">Submit ★</button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 animate-bounce-in">
                  <div className="text-5xl mb-3">🙏</div>
                  <h3 className="text-xl font-black text-white">Thanks for rating!</h3>
                  <p className="text-slate-400 text-sm mt-1">Redirecting to home...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── RENDER: RESTAURANT MENU VIEW ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedRestaurant) {
    const isFav = favoriteIds.includes(selectedRestaurant.id);
    return (
      <div className="min-h-screen bg-[#0f172a] text-white font-sans relative pb-28">
        {/* Hero Image */}
        <div className="h-64 w-full relative">
          <img src={selectedRestaurant.img || selectedRestaurant.image_url} alt={selectedRestaurant.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent" />
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
            <button onClick={() => setSelectedRestaurant(null)} className="bg-black/50 backdrop-blur-md text-white p-2.5 rounded-full font-bold hover:bg-black/70 transition">
              ← Back
            </button>
            <button onClick={() => toggleFavorite(selectedRestaurant.id)} className={`p-2.5 rounded-full backdrop-blur-md transition ${isFav ? 'bg-rose-500/70 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
              {isFav ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        <div className="px-4 -mt-10 relative z-10 max-w-2xl mx-auto">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-3xl font-black text-white">{selectedRestaurant.name}</h1>
              <p className="text-slate-400 text-sm mt-1">{selectedRestaurant.tags || 'Delicious food, delivered fast.'}</p>
            </div>
            <div className="bg-emerald-600 text-white text-sm font-black px-3 py-1.5 rounded-xl flex items-center gap-1 mt-2 shrink-0">
              ⭐ {selectedRestaurant.rating || '4.5'}
            </div>
          </div>

          {/* Info Row */}
          <div className="flex gap-3 mb-6 mt-3 flex-wrap">
            {['🕐 20-30 min', '📍 1.2 km', '🛵 ₹40 delivery'].map((b, i) => (
              <span key={i} className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-white/5">{b}</span>
            ))}
          </div>

          {/* Category Tabs */}
          {menuCategories.length > 1 && (
            <div className="chips-row flex gap-2 overflow-x-auto pb-3 mb-6">
              {menuCategories.map(cat => (
                <button key={cat} onClick={() => setActiveMenuCat(cat)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeMenuCat === cat ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Menu Items */}
          {menuLoading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredMenu.map((item, idx) => {
                const cartItem = cart.find(c => c.id === item.id);
                const isBestSeller = idx < 2;
                return (
                  <div key={item.id} className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition group animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex gap-4 flex-1 min-w-0">
                      {item.image_url && <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shadow-md shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white">{item.name}</h3>
                          {isBestSeller && <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">⭐ BESTSELLER</span>}
                        </div>
                        <p className="text-emerald-400 font-black text-lg mt-0.5">₹{item.price}</p>
                        <p className="text-slate-500 text-xs mt-1 line-clamp-2">{item.category} • Freshly prepared</p>
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-xl flex items-center border border-emerald-500/20 overflow-hidden ml-3 shrink-0">
                      {cartItem ? (
                        <>
                          <button onClick={() => removeFromCart(item.id)} className="w-9 h-9 text-emerald-400 hover:bg-slate-700 font-black text-lg transition flex items-center justify-center">−</button>
                          <span className="w-8 text-center font-black text-white text-sm">{cartItem.quantity}</span>
                          <button onClick={() => addToCart(item)} className="w-9 h-9 text-emerald-400 hover:bg-slate-700 font-black text-lg transition flex items-center justify-center">+</button>
                        </>
                      ) : (
                        <button onClick={() => addToCart(item)} className="px-5 py-2 text-emerald-400 font-black text-sm hover:bg-slate-700 transition">ADD</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredMenu.length === 0 && <p className="text-slate-500 text-center py-12">No items in this category yet.</p>}
            </div>
          )}
        </div>

        {/* Floating Cart Bar */}
        {cart.length > 0 && !splitRoomMode && (
          <div className="fixed bottom-0 left-0 w-full p-4 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-50 animate-slide-up">
            <div className="max-w-2xl mx-auto flex justify-between items-center gap-3">
              <div>
                <p className="text-xs text-slate-400 font-bold">{cartCount} Items selected</p>
                <p className="text-2xl font-black text-white">₹{cartTotal}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSplitRoomMode(true)} className="bg-slate-800 border border-emerald-500/30 text-emerald-400 font-bold py-3 px-4 rounded-xl hover:bg-slate-700 transition text-sm">
                  Split 👥
                </button>
                <button onClick={() => setShowCartDrawer(true)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-6 rounded-xl shadow-lg shadow-emerald-500/20 transition transform hover:scale-105">
                  View Cart ({cartCount}) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cart Drawer */}
        {showCartDrawer && (
          <div className="fixed inset-0 z-[100] flex items-end">
            <div className="absolute inset-0 bg-black/60 drawer-overlay" onClick={() => setShowCartDrawer(false)} />
            <div className="relative w-full bg-slate-900 rounded-t-3xl border-t border-white/10 p-6 animate-drawer-open max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Your Cart</h3>
                <button onClick={() => setShowCartDrawer(false)} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center">✕</button>
              </div>

              {/* Cart Items */}
              <div className="space-y-3 mb-6">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-white/5">
                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{item.name}</p>
                      <p className="text-emerald-400 font-black">₹{item.price * item.quantity}</p>
                    </div>
                    <div className="bg-slate-700 rounded-lg flex items-center border border-white/5">
                      <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 text-slate-300 hover:text-white flex items-center justify-center font-bold">−</button>
                      <span className="w-6 text-center font-black text-white text-sm">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-8 h-8 text-slate-300 hover:text-white flex items-center justify-center font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Promo Code */}
              <div className="flex gap-2 mb-5">
                <input value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} placeholder="LOCALBITE10" disabled={promoApplied}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500 transition font-mono tracking-widest" />
                <button onClick={applyPromo} disabled={promoApplied}
                  className={`px-5 py-3 rounded-xl font-bold text-sm transition ${promoApplied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'}`}>
                  {promoApplied ? '✓ Applied!' : 'Apply'}
                </button>
              </div>

              {/* Bill Summary */}
              <div className="bg-slate-800/50 rounded-2xl p-4 mb-5 border border-white/5 space-y-2">
                <div className="flex justify-between text-sm text-slate-400"><span>Subtotal</span><span>₹{cartTotal}</span></div>
                <div className="flex justify-between text-sm text-slate-400"><span>Delivery Fee</span><span>₹{deliveryFee}</span></div>
                <div className="flex justify-between text-sm text-slate-400"><span>GST (5%)</span><span>₹{(cartTotal * gstRate).toFixed(0)}</span></div>
                {promoApplied && <div className="flex justify-between text-sm text-emerald-400"><span>🎉 Promo (LOCALBITE10)</span><span>−₹{promoDiscount}</span></div>}
                <div className="border-t border-white/10 pt-2 flex justify-between font-black text-xl text-white">
                  <span>Grand Total</span>
                  <span>₹{Math.max(0, cartTotal + deliveryFee + Math.round(cartTotal * gstRate) - promoDiscount)}</span>
                </div>
              </div>

              {/* Address */}
              <div className="mb-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Delivering to</p>
                <div className="flex items-center gap-2 bg-slate-800/50 border border-white/5 p-3 rounded-xl">
                  <span className="text-lg">📍</span>
                  <span className="text-sm text-slate-300 font-medium">{savedAddresses[0] || 'Current Location'}</span>
                </div>
              </div>

              <button onClick={checkoutCart} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition transform hover:scale-[1.01] text-lg">
                Place Order · ₹{Math.max(0, cartTotal + deliveryFee + Math.round(cartTotal * gstRate) - promoDiscount)} →
              </button>
            </div>
          </div>
        )}

        {/* Split Bill Modal */}
        {splitRoomMode && (
          <div className="fixed inset-0 z-[100] bg-black/80 drawer-overlay flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative animate-bounce-in max-h-[92vh] overflow-y-auto">
              <button onClick={handleLeaveRoom} className="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center z-10">✕</button>

              {/* ── IDLE: Choose create or join ── */}
              {roomState === 'idle' && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-3">👥</div>
                  <h2 className="text-2xl font-black text-white mb-2">Split Bill</h2>
                  <p className="text-sm text-slate-400 mb-8">Share costs with friends in a private room.</p>
                  <div className="flex flex-col gap-3">
                    <button onClick={() => { setRoomState('create'); setSplitError(''); }} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition hover:scale-[1.02]">🏠 Create Private Room</button>
                    <button onClick={() => { setRoomState('join'); setSplitError(''); }} className="w-full bg-slate-800 border border-emerald-500/30 text-emerald-400 font-bold py-4 rounded-xl hover:bg-slate-700 transition">🔑 Join Existing Room</button>
                  </div>
                </div>
              )}

              {/* ── CREATE ROOM ── */}
              {roomState === 'create' && (
                <div>
                  <button onClick={() => setRoomState('idle')} className="text-slate-400 hover:text-white text-sm font-bold mb-4 flex items-center gap-1">← Back</button>
                  <h2 className="text-xl font-black text-white mb-1">Create Room</h2>
                  <p className="text-xs text-slate-400 mb-5">Your cart (₹{cartTotal}) will be your share.</p>
                  <input type="text" placeholder="Your display name" value={splitDisplayName} onChange={e => setSplitDisplayName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 px-5 outline-none focus:border-emerald-500 text-sm mb-3" />
                  <input type="text" placeholder="Set a 4-digit PIN" value={roomPin} onChange={e => setRoomPin(e.target.value.replace(/\D/g,''))} maxLength={6}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500 text-center text-2xl tracking-[0.5em] mb-4 font-black" />
                  {splitError && <p className="text-rose-400 text-xs font-bold mb-3 text-center">{splitError}</p>}
                  <button onClick={handleCreateRoom} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition hover:scale-[1.02]">Generate Room Code →</button>
                </div>
              )}

              {/* ── JOIN ROOM ── */}
              {roomState === 'join' && (
                <div>
                  <button onClick={() => setRoomState('idle')} className="text-slate-400 hover:text-white text-sm font-bold mb-4 flex items-center gap-1">← Back</button>
                  <h2 className="text-xl font-black text-white mb-1">Join Room</h2>
                  <p className="text-xs text-slate-400 mb-5">Your cart (₹{cartTotal}) will be your share.</p>
                  <input type="text" placeholder="Your display name" value={splitDisplayName} onChange={e => setSplitDisplayName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 px-5 outline-none focus:border-emerald-500 text-sm mb-3" />
                  <input type="text" placeholder="Room Code (e.g. LB-ABC123)" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-3 px-5 outline-none focus:border-emerald-500 text-center text-lg mb-3 uppercase font-mono" />
                  <input type="text" placeholder="4-digit PIN" value={roomPin} onChange={e => setRoomPin(e.target.value.replace(/\D/g,''))} maxLength={6}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500 text-center text-2xl tracking-[0.5em] mb-4 font-black" />
                  {splitError && <p className="text-rose-400 text-xs font-bold mb-3 text-center">{splitError}</p>}
                  <button onClick={handleJoinRoom} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition hover:scale-[1.02]">Join Room →</button>
                </div>
              )}

              {/* ── ACTIVE ROOM ── */}
              {roomState === 'active' && roomDetails && (() => {
                const myMember = roomDetails.members?.find(m => m.user_id === currentCustomerId);
                const iAmReady = myMember?.is_ready || false;
                const totalGrand = (roomDetails.total_cart || 0) + deliveryFee + Math.round((roomDetails.total_cart || 0) * gstRate);

                // ── DELIVERED STATE (guests see this after host marks delivered) ──
                if (!roomDetails.is_host && roomDetails.delivery_status === 'delivered') {
                  fireConfetti();
                  return (
                    <div className="text-center py-6">
                      <div className="text-6xl mb-4">🎊</div>
                      <h2 className="text-2xl font-black text-white mb-2">Order Delivered!</h2>
                      <p className="text-slate-400 text-sm mb-6">Great news! Your group order has been delivered successfully.</p>
                      <div className="bg-slate-800/60 rounded-2xl p-4 mb-6 text-left space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Group Summary</p>
                        {roomDetails.members?.map(m => (
                          <div key={m.user_id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                m.is_host ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>{m.display_name?.[0]?.toUpperCase()}</div>
                              <span className="text-sm font-bold text-white">{m.display_name}{m.is_host ? ' (Host)' : ''}</span>
                            </div>
                            <span className="text-emerald-400 font-black text-sm">₹{m.cart_total?.toFixed(0)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/10 pt-2 flex justify-between font-black text-white">
                          <span>Total Paid</span>
                          <span>₹{totalGrand}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => { stopRoomPolling(); setSplitRoomMode(false); setRoomState('idle'); setRoomDetails(null); setRoomPin(''); setJoinCode(''); setSplitDisplayName(''); setSplitError(''); }}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-xl transition hover:scale-[1.02]"
                      >
                        🏠 Back to Home
                      </button>
                    </div>
                  );
                }

                // ── ORDER PLACED STATE (guests see this after host places order) ──
                if (!roomDetails.is_host && roomDetails.order_placed) {
                  return (
                    <div className="text-center py-4">
                      <div className="text-5xl mb-4 animate-bounce">🛵</div>
                      <h2 className="text-xl font-black text-white mb-2">Order is on its way!</h2>
                      <p className="text-slate-400 text-sm mb-6">The host has placed the group order. Waiting for delivery...</p>
                      <div className="bg-slate-800/60 rounded-2xl p-4 mb-6 text-left space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Your Group Order</p>
                        {roomDetails.members?.map(m => (
                          <div key={m.user_id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                m.is_host ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>{m.display_name?.[0]?.toUpperCase()}</div>
                              <div>
                                <p className="text-sm font-bold text-white">{m.display_name}{m.is_host ? ' (Host)' : ''}</p>
                                <p className="text-[10px] text-slate-500 max-w-[150px] truncate">{(m.cart_items || []).map(i => `${i.quantity}× ${i.name}`).join(', ')}</p>
                              </div>
                            </div>
                            <span className="text-emerald-400 font-black text-sm">₹{m.cart_total?.toFixed(0)}</span>
                          </div>
                        ))}
                        <div className="border-t border-white/10 pt-2 flex justify-between font-black text-white">
                          <span>Grand Total</span>
                          <span>₹{totalGrand}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                        <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        <span>Polling for delivery update every 3s...</span>
                      </div>
                    </div>
                  );
                }

                // ── NORMAL ACTIVE ROOM VIEW ──
                return (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-black text-white">Split Bill Room</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{roomDetails.member_count} {roomDetails.member_count === 1 ? 'person' : 'people'} in room</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${roomDetails.all_ready ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${roomDetails.all_ready ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {roomDetails.all_ready ? 'All Ready!' : 'Waiting...'}
                      </div>
                    </div>

                    {/* Room Code Banner */}
                    <div className="bg-slate-800/80 border border-emerald-500/20 rounded-2xl p-4 flex justify-between items-center mb-4">
                      <div>
                        <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-0.5">Room Code</p>
                        <p className="text-2xl font-mono font-black text-white tracking-wider">{roomDetails.room_code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest mb-0.5">PIN</p>
                        <p className="text-2xl font-mono font-black tracking-[0.4em] text-white">{roomPin}</p>
                      </div>
                    </div>

                    {/* Poll notification banner (non-host) */}
                    {roomDetails.poll_requested && !roomDetails.is_host && !iAmReady && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-center gap-2 animate-pulse">
                        <span className="text-lg">📣</span>
                        <div>
                          <p className="text-amber-400 font-black text-sm">Owner is requesting everyone to get ready!</p>
                          <p className="text-amber-400/70 text-xs">Press the Ready button below.</p>
                        </div>
                      </div>
                    )}

                    {/* Members List */}
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Members & Their Cart</p>
                      <div className="space-y-2">
                        {roomDetails.members?.map((member) => (
                          <div key={member.user_id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                            member.is_ready
                              ? 'bg-emerald-500/5 border-emerald-500/30'
                              : 'bg-slate-800/50 border-white/5'
                          }`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                              member.is_host
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950'
                                : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950'
                            }`}>
                              {member.display_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white text-sm truncate">{member.display_name}</p>
                                {member.is_host && <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">HOST</span>}
                                {member.user_id === currentCustomerId && <span className="text-[9px] bg-slate-600/40 text-slate-400 border border-slate-600/30 px-1.5 py-0.5 rounded-full font-black uppercase shrink-0">YOU</span>}
                              </div>
                              {member.cart_items?.length > 0 && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5">{member.cart_items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-emerald-400 text-sm">₹{member.cart_total?.toFixed(0) || '0'}</p>
                              <div className={`flex items-center gap-1 justify-end mt-0.5 ${
                                member.is_ready ? 'text-emerald-400' : 'text-slate-500'
                              }`}>
                                <span className="text-[10px] font-bold">{member.is_ready ? '✅ Ready' : '⏳ Waiting'}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bill Summary */}
                    <div className="bg-slate-800/40 rounded-2xl p-4 mb-4 border border-white/5 space-y-1.5 text-sm">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Group Bill</p>
                      <div className="flex justify-between text-slate-400"><span>Items total (all members)</span><span>₹{roomDetails.total_cart?.toFixed(0) || 0}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Delivery Fee</span><span>₹{deliveryFee}</span></div>
                      <div className="flex justify-between text-slate-400"><span>GST (5%)</span><span>₹{Math.round((roomDetails.total_cart || 0) * gstRate)}</span></div>
                      <div className="border-t border-white/10 pt-2 flex justify-between font-black text-white text-base">
                        <span>Grand Total</span>
                        <span>₹{totalGrand}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      {/* Ready Button — for everyone */}
                      <button
                        onClick={() => handleSetReady(roomDetails.room_code, !iAmReady)}
                        className={`w-full py-4 rounded-xl font-black text-base transition-all transform hover:scale-[1.02] ${
                          iAmReady
                            ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 hover:bg-emerald-500/30'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                        }`}
                      >
                        {iAmReady ? '✅ Ready! (tap to undo)' : '✅ I\'m Ready'}
                      </button>

                      {/* Host-only buttons */}
                      {roomDetails.is_host && (
                        <>
                          <button
                            onClick={() => handlePollMembers(roomDetails.room_code)}
                            className="w-full py-3.5 rounded-xl font-black text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
                          >
                            <span>📣</span>
                            <span>Poll Members — Ask Everyone to Get Ready</span>
                          </button>

                          {roomDetails.all_ready && (
                            <button
                              onClick={handlePlaceGroupOrder}
                              className="w-full py-4 rounded-xl font-black text-base bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-xl shadow-emerald-500/30 animate-pulse hover:animate-none hover:from-emerald-400 hover:to-teal-400 transition-all transform hover:scale-[1.02]"
                            >
                              🚀 Place Group Order · ₹{totalGrand}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Update cost link */}
                    <button
                      onClick={() => handleUpdateCost(roomDetails.room_code)}
                      className="w-full text-center text-xs text-slate-500 hover:text-slate-300 font-bold mt-3 py-2 transition"
                    >
                      🔄 Sync my cart (₹{cartTotal}) to room
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── RENDER: MAIN HOME / DISCOVERY FEED ───────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans overflow-x-hidden">
      <div className="w-full max-w-2xl mx-auto bg-slate-900 min-h-screen shadow-2xl relative">

        {/* ── STICKY HEADER ── */}
        <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-xl pt-4 pb-2 px-4 border-b border-white/5">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 text-2xl">📍</span>
              <div>
                <h3 className="font-black text-white text-lg leading-tight flex items-center gap-1">Home <span className="text-xs text-slate-500">▼</span></h3>
                <p className="text-xs text-slate-400">Near Current Location</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black text-sm hover:scale-110 transition">
                U
              </button>
            </div>
          </div>

          {/* AI Search Bar */}
          <div className="relative mb-3">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{searchLoading ? '⏳' : '🔍'}</span>
            <input type="text" value={vibeQuery} onChange={e => setVibeQuery(e.target.value)} onKeyDown={handleVibeSearch}
              placeholder="Try 'spicy biryani under ₹200'..."
              className="w-full bg-slate-800/80 text-white rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-1 focus:ring-emerald-500 border border-white/5 text-sm" />
            {aiDecision && <button onClick={() => setAiDecision(null)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs font-bold">✕ Clear</button>}
          </div>

          {/* Category Chips */}
          <div className="chips-row flex gap-2 overflow-x-auto pb-2">
            {categoriesWithAll.map(cat => (
              <button key={cat.name} onClick={() => setActiveCategory(activeCategory === cat.tag ? null : cat.tag)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                  (activeCategory === cat.tag || (cat.tag === null && !activeCategory))
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'
                }`}>
                <span className="text-sm">{cat.icon}</span> {cat.name}
              </button>
            ))}
          </div>
        </div>

        {status && <div className="px-4 py-2 text-center text-emerald-400 text-sm font-bold bg-emerald-500/10 border-b border-emerald-500/20">{status}</div>}

        {/* ── BOTTOM NAV ── */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 px-4 py-2 flex justify-around items-center">
          {[
            { id: 'home', icon: '🏠', label: 'Explore' },
            { id: 'history', icon: '📋', label: 'Orders', badge: orderHistory.length },
            { id: 'favorites', icon: '❤️', label: 'Saved', badge: favoriteRestaurants.length },
            { id: 'profile', icon: '👤', label: 'Profile' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setViewMode(tab.id); if (tab.id === 'profile') setShowProfile(true); }}
              className={`flex flex-col items-center gap-0.5 relative transition-all px-3 py-1 rounded-xl ${viewMode === tab.id ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide">{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-full flex items-center justify-center">{tab.badge > 9 ? '9+' : tab.badge}</span>
              )}
              {viewMode === tab.id && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-emerald-400 rounded-full" />}
            </button>
          ))}
        </div>

        {/* ── CONTENT AREA ── */}
        <div className="pb-24">

          {/* Hero Banner Carousel */}
          {viewMode === 'home' && (
            <div className="relative mx-4 mt-4 mb-6 rounded-3xl overflow-hidden h-40 shadow-xl">
              {HERO_SLIDES.map((slide, i) => (
                <div key={i} className={`absolute inset-0 transition-all duration-700 ${i === heroSlide ? 'opacity-100 translate-x-0' : i < heroSlide ? 'opacity-0 -translate-x-full' : 'opacity-0 translate-x-full'}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg}`} />
                  <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/20">{slide.tag}</span>
                      <span className="text-4xl">{slide.emoji}</span>
                    </div>
                    <div>
                      <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">{slide.label}</p>
                      <p className="text-white font-black text-xl">{slide.title}</p>
                      <p className="text-slate-300 text-xs mt-0.5">{slide.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
              {/* Dot indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                {HERO_SLIDES.map((_, i) => (
                  <button key={i} onClick={() => { setHeroSlide(i); clearInterval(heroTimer.current); }}
                    className={`h-1.5 rounded-full transition-all ${i === heroSlide ? 'bg-white w-5' : 'bg-white/40 w-1.5'}`} />
                ))}
              </div>
            </div>
          )}

          {/* AI Decision Result */}
          {aiDecision && viewMode === 'home' && (
            <div className="mx-4 mb-6 animate-fade-in">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🤖</span>
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">AI Anti-Paralysis Engine</span>
                </div>
                <p className="text-slate-200 text-sm p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/10 mb-4">"{aiDecision.verdict}"</p>
                {aiDecision.has_split_decision && (
                  <div className="grid grid-cols-2 gap-3 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 rounded-full w-8 h-8 flex items-center justify-center text-xs font-black z-10">VS</div>
                    {[aiDecision.contender_a, aiDecision.contender_b].map((c, i) => (
                      <div key={i} onClick={() => openMenu(c)} className="p-4 rounded-2xl cursor-pointer border bg-slate-900 border-white/5 hover:border-emerald-500/50 transition">
                        <h4 className="font-bold text-white truncate">{c.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">⭐ {c.rating}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ORDER HISTORY ── */}
          {viewMode === 'history' && (
            <div className="p-4 animate-fade-in">
              <h2 className="text-xl font-black mb-5">Order History</h2>
              {orderHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4 opacity-50">📋</div>
                  <p className="text-slate-400 text-lg font-bold">No orders yet</p>
                  <p className="text-slate-500 text-sm mt-1">Place your first order to get started!</p>
                  <button onClick={() => setViewMode('home')} className="mt-6 bg-emerald-500 text-slate-950 font-black px-6 py-3 rounded-xl hover:bg-emerald-400 transition">Browse Restaurants →</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orderHistory.map((order, idx) => (
                    <div key={order.id} className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-black text-white">{order.restaurant?.name || 'Restaurant'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{new Date(order.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${order.status === 'delivered' || order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {order.status}
                        </span>
                      </div>
                      {/* Status Timeline */}
                      <div className="flex items-center gap-1 mb-3">
                        {['Ordered', 'Prepared', 'Picked Up', 'Delivered'].map((s, i) => (
                          <React.Fragment key={i}>
                            <div className={`h-1 flex-1 rounded-full ${i < 4 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                          </React.Fragment>
                        ))}
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{Array.isArray(order.items) ? order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') : order.items}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-emerald-400 font-black">₹{order.total}</p>
                        <button onClick={() => { openMenu(order.restaurant); }} className="text-xs bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg transition">
                          🔄 Reorder
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FAVORITES ── */}
          {viewMode === 'favorites' && (
            <div className="p-4 animate-fade-in">
              <h2 className="text-xl font-black mb-5">Saved Restaurants</h2>
              {favoriteRestaurants.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4 opacity-50">❤️</div>
                  <p className="text-slate-400 text-lg font-bold">No favorites yet</p>
                  <p className="text-slate-500 text-sm mt-1">Tap ❤️ on a restaurant to save it</p>
                  <button onClick={() => setViewMode('home')} className="mt-6 bg-rose-500 text-white font-black px-6 py-3 rounded-xl hover:bg-rose-400 transition">Explore →</button>
                </div>
              ) : (
                <div className="space-y-5">
                  {favoriteRestaurants.map((rest, idx) => (
                    <div key={rest.id} onClick={() => openMenu(rest)} className="group cursor-pointer animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                      <div className="w-full h-44 rounded-2xl overflow-hidden relative shadow-lg mb-2">
                        <img src={rest.img || rest.image_url} alt={rest.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                          <p className="font-black text-xl text-white">{rest.name}</p>
                          <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-black px-2 py-1 rounded-lg">⭐ {rest.rating}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MAIN FEED ── */}
          {viewMode === 'home' && (
            <div className="p-4">
              {!aiDecision && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black">{activeCategory ? `${categoriesWithAll.find(c=>c.tag===activeCategory)?.name || ''} Near You` : 'Top Restaurants for You'}</h2>
                    <span className="text-xs text-slate-500 font-bold">{filteredRestaurants.length} places</span>
                  </div>
                  <div className="space-y-6">
                    {feedLoading ? (
                      [1,2,3].map(i => <RestaurantSkeleton key={i} />)
                    ) : filteredRestaurants.length > 0 ? (
                      filteredRestaurants.map((rest, idx) => {
                        const isFav = favoriteIds.includes(rest.id);
                        const discount = getDiscount(idx);
                        return (
                          <div key={rest.id} className="group animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                            <div className="w-full h-52 rounded-2xl overflow-hidden relative shadow-xl mb-3 cursor-pointer" onClick={() => openMenu(rest)}>
                              <img src={rest.img || rest.image_url} alt={rest.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                              {discount && (
                                <div className="absolute top-3 left-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
                                  {discount}
                                </div>
                              )}
                              <button onClick={e => { e.stopPropagation(); toggleFavorite(rest.id); }}
                                className={`absolute top-3 right-3 w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition hover:scale-110 ${isFav ? 'bg-rose-500/80 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}>
                                {isFav ? '❤️' : '🤍'}
                              </button>
                              <div className="absolute bottom-3 left-3 flex gap-2">
                                <span className="text-xs bg-black/60 backdrop-blur-md text-white font-bold px-2 py-1 rounded-full">🕐 {rest.delivery_time || rest.time || '20–30 min'}</span>
                                {rest.address && <span className="text-xs bg-black/60 backdrop-blur-md text-white font-bold px-2 py-1 rounded-full">📍 {rest.address.split(',')[0]}</span>}
                              </div>
                            </div>
                            <div className="flex justify-between items-start px-1" onClick={() => openMenu(rest)}>
                              <div className="cursor-pointer">
                                <h3 className="text-xl font-black text-slate-100 group-hover:text-emerald-400 transition">{rest.name}</h3>
                                <p className="text-sm text-slate-400 mt-0.5">{rest.tags || 'Local Kitchen'}</p>
                              </div>
                              <div className="bg-emerald-700/80 text-white text-xs font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0">
                                {rest.rating} ★
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-16">
                        <div className="text-6xl mb-4 opacity-40">🍽️</div>
                        <p className="text-slate-400">No restaurants in this category yet.</p>
                        <button onClick={() => setActiveCategory(null)} className="mt-4 text-emerald-400 font-bold text-sm hover:text-emerald-300">Show all restaurants</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Drawer */}
      {showProfile && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="absolute inset-0 bg-black/60 drawer-overlay" onClick={() => setShowProfile(false)} />
          <div className="relative ml-auto w-80 h-full bg-slate-900 border-l border-white/10 flex flex-col animate-slide-in-right">
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 font-black text-2xl">U</div>
                <div>
                  <p className="font-black text-white text-lg">LocalBite User</p>
                  <p className="text-slate-400 text-xs">Premium Member 🌟</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {[
                { icon: '📋', label: 'My Orders', action: () => { setViewMode('history'); setShowProfile(false); } },
                { icon: '❤️', label: 'Saved Restaurants', action: () => { setViewMode('favorites'); setShowProfile(false); } },
                { icon: '📍', label: 'Saved Addresses', action: null },
                { icon: '🔔', label: 'Notifications', action: null },
                { icon: '🎁', label: 'Offers & Vouchers', action: null },
                { icon: '⭐', label: 'My Reviews', action: null },
                { icon: '💳', label: 'Payment Methods', action: null },
                { icon: '🛡️', label: 'Privacy & Security', action: null },
                { icon: 'ℹ️', label: 'About LocalBite AI', action: null },
              ].map((item, i) => (
                <button key={i} onClick={item.action || undefined} className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-slate-800 transition text-left group">
                  <span className="text-xl w-8">{item.icon}</span>
                  <span className="font-semibold text-slate-300 group-hover:text-white flex-1">{item.label}</span>
                  <span className="text-slate-600 group-hover:text-slate-400">›</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-white/5">
              <button onClick={() => { setShowProfile(false); goBack(); }} className="w-full py-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold hover:bg-rose-500/20 transition">
                🚪 Log Out
              </button>
              <p className="text-center text-slate-600 text-xs mt-3">LocalBite AI v2.0 · Made with ❤️</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}