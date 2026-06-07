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

export default function RiderScreen({ goBack, globalOrders, updateGlobalOrderStatus }) {
  const [email, setEmail] = useState('harsh01@gmail.com');
  const [riderId, setRiderId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [status, setStatus] = useState('🟡 Waiting to connect...');
  const [offer, setOffer] = useState(null);
  const [isDriving, setIsDriving] = useState(false);
  const [currentLocation, setCurrentLocation] = useState([21.1458, 79.0882]);
  const [pathHistory, setPathHistory] = useState([[21.1458, 79.0882]]);
  const [fullRoute, setFullRoute] = useState([]); 
  
  const [earnings, setEarnings] = useState(0);
  const [trips, setTrips] = useState(0);
  const [riderMetrics, setRiderMetrics] = useState({ rating: 4.8, acceptanceRate: 92, todayTrips: 0 });
  const [dbAvailableOrders, setDbAvailableOrders] = useState([]);
  
  // 🚨 CRITICAL FIX: The Rider now actively watches the Global Queue for 'ready' orders!
  const availablePickups = [...dbAvailableOrders, ...globalOrders.filter(go => go.status === 'ready' && !dbAvailableOrders.find(dbo => dbo.id === go.id))];
  
  const wsRef = useRef(null);
  const driveInterval = useRef(null);
  const metricsInterval = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected'); 

  const fetchEarnings = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/riders/${id}/earnings`);
      if (response.ok) {
        const data = await response.json();
        setEarnings(data.total_earnings);
        setTrips(data.completed_trips);
      }
    } catch (error) { console.log("Could not fetch earnings"); }
  };

  const fetchRiderMetrics = async (id) => {
    const metrics = await apiService.getRiderMetrics(id);
    if(metrics) setRiderMetrics(metrics);
  };

  const handleLogin = async () => {
    setStatus('⏳ Authenticating...');
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/riders/login", { 
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) 
      });
      if (response.ok) {
        const data = await response.json();
        setRiderId(data.rider_id);
        setIsLoggedIn(true);
        fetchEarnings(data.rider_id);
      } else setStatus('❌ Rider not found.');
    } catch (error) { setStatus('❌ Server connection failed.'); }
  };

  useEffect(() => {
    if (!isLoggedIn || !riderId) return;
    
    // 🚨 NEW: Connect WebSocket using enhanced service
    wsRef.current = apiService.connectRiderWS(
      riderId,
      (data) => {
        console.log("📨 Rider received update:", data);
        
        if (data.type === "metrics_update") {
          setRiderMetrics(data.metrics);
        }
        
        // 🚨 NEW: Handle new order offers from backend
        if (data.type === "new_order_offer" || data.type === "order_ready_for_pickup" || data.type === "food_ready") {
          console.log("🎯 NEW ORDER OFFER:", data);
          setStatus("🔔 New order nearby! Check available pickups.");
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => {});
          
          apiService.getAvailableOrdersForRider().then(orders => setDbAvailableOrders(orders));
          
          // Add to available pickups
          if (updateGlobalOrderStatus) {
            updateGlobalOrderStatus(data.order_id, 'available', data);
          }
        }
      },
      (status) => {
        setWsStatus(status);
        if (status === 'connected') {
          console.log("✅ Rider WebSocket connected - listening for order offers");
          setStatus("🟢 ONLINE: Scanning for nearby orders...");
          fetchRiderMetrics(riderId);
        }
      }
    );

    // Polling as fallback
    fetchRiderMetrics(riderId);
    metricsInterval.current = setInterval(() => {
      fetchRiderMetrics(riderId);
      fetchEarnings(riderId);
    }, 30000);
    
    // 🚨 Poll backend for available orders every 5 seconds
    const fetchAvailable = async () => {
      const orders = await apiService.getAvailableOrdersForRider();
      setDbAvailableOrders(orders);
    };
    fetchAvailable(); // Fetch immediately
    const pollInterval = setInterval(fetchAvailable, 5000);
    
    return () => { 
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null; 
      if (driveInterval.current) clearInterval(driveInterval.current);
      if (metricsInterval.current) clearInterval(metricsInterval.current);
      clearInterval(pollInterval);
    };
  }, [isLoggedIn, riderId]);

  // 🚨 NEW: When a rider clicks "Accept Pickup" from the live queue
  const acceptPickup = async (order) => {
    setStatus('🚨 Accepting order...');
    
    try {
      // Call backend to accept the order
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${order.id}/rider/accept?rider_id=${riderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        setOffer(order);
        setStatus('🎯 Order accepted! Route calculated. Ready to deliver.');
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => {});
        
        // Update global state
        if (updateGlobalOrderStatus) {
          updateGlobalOrderStatus(order.id, 'assigned', { rider_id: riderId, rider_name: email.split('@')[0] });
        }
      } else {
        setStatus('❌ Failed to accept order');
      }
    } catch (e) {
      console.error("Error accepting order:", e);
      setStatus('❌ Error accepting order');
    }
    
    setTimeout(() => setStatus(''), 3000);
  };

  // 🚨 NEW: When rider rejects an order
  const rejectPickup = async (orderId) => {
    setStatus('👎 Rejecting order...');
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${orderId}/rider/reject?rider_id=${riderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        setStatus('✅ Order rejected - offered to other riders');
      }
    } catch (e) {
      console.error("Error rejecting order:", e);
    }
    
    setTimeout(() => setStatus(''), 3000);
  };

  const startDriving = async () => {
    if (!offer) return;
    setStatus('⏳ Starting delivery...');
    
    try {
      // Call backend to mark order as in_delivery
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.id}/in-delivery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) {
        console.error("Failed to update delivery status");
      }
    } catch (e) {
      console.error("Error:", e);
    }

    // Generate a simulated route from restaurant to delivery location
    const startLat = 21.1458;
    const startLng = 79.0882;
    const endLat = 21.1558;
    const endLng = 79.0782;
    const steps = 20;
    const generatedRoute = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      // Add some randomness for realistic path
      const jitterLat = (Math.random() - 0.5) * 0.001;
      const jitterLng = (Math.random() - 0.5) * 0.001;
      generatedRoute.push([
        startLat + (endLat - startLat) * progress + jitterLat,
        startLng + (endLng - startLng) * progress + jitterLng
      ]);
    }
    setFullRoute(generatedRoute);
    setPathHistory([generatedRoute[0]]);

    setIsDriving(true);
    setStatus('🛵 IN TRANSIT: Navigating traffic...');

    let currentIndex = 0;
    driveInterval.current = setInterval(async () => {
      if (currentIndex >= generatedRoute.length) {
        clearInterval(driveInterval.current);
        setStatus('📍 Arrived at destination! Tap "Delivered" to complete.');
        return;
      }
      const nextPoint = generatedRoute[currentIndex];
      setCurrentLocation(nextPoint);
      setPathHistory(prev => [...prev, nextPoint]);
      
      // Update global state
      if (updateGlobalOrderStatus) {
        updateGlobalOrderStatus(offer.id, 'in_delivery', { 
          rider_location: { lat: nextPoint[0], lng: nextPoint[1] } 
        });
      }
      
      currentIndex++;
    }, 500);
  };

  const completeDelivery = async () => {
    if (!offer) return;
    clearInterval(driveInterval.current);
    setStatus('⏳ Finalizing delivery...');
    
    try {
      // Call backend to mark order as delivered
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.id}/complete-delivery`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      });
      
      if (res.ok) {
        // Update global state
        if (updateGlobalOrderStatus) {
          updateGlobalOrderStatus(offer.id, 'delivered');
        }
        
        // Fetch updated earnings
        await fetchEarnings(riderId);
        
        setStatus('✅ Delivered! Earnings updated. Scanning for next order...');
        setIsDriving(false); 
        setOffer(null); 
        setPathHistory([[21.1458, 79.0882]]);
      } else {
        setStatus('❌ Failed to complete delivery');
      }
    } catch (error) { 
      console.error("Error completing delivery:", error);
      setStatus('❌ Error completing delivery');
    }
    
    setTimeout(() => setStatus('🟢 ONLINE: Scanning for nearby orders...'), 3000);
  };

  const rejectOrder = async () => {
    if (!offer) return;
    
    try {
      await rejectPickup(offer.id);
    } catch (e) {
      console.error("Error rejecting order:", e);
    }
    
    setOffer(null);
    setStatus('✋ Order rejected. Waiting for next offer...');
    setTimeout(() => setStatus('🟢 ONLINE: Scanning for nearby orders...'), 2000);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/10 text-center">
          <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Rider Portal</h2>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-rose-500 outline-none mb-6 text-center text-lg" />
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-1 text-lg">Go Online 🛵</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 transition-all">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Rider Dashboard</h2>
            {/* 🚨 NEW: WebSocket Status Indicator */}
            <div className={`text-xs px-3 py-1 rounded-full font-bold ${wsStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400' : wsStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-400' : 'bg-slate-600/20 text-slate-400 border border-slate-600'}`}>
              {wsStatus === 'connected' ? '🟢 Connected' : wsStatus === 'error' ? '🔴 Retrying...' : '🟡 Connecting...'}
            </div>
          </div>
          <button onClick={() => { setIsLoggedIn(false); setRiderId(''); }} className="text-slate-400 hover:text-white font-semibold transition px-4 py-2 bg-slate-800 rounded-xl">Log Out</button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Today's Earnings</p>
            <p className="text-4xl font-black text-emerald-400">₹{earnings}</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Completed Trips</p>
            <p className="text-4xl font-black text-rose-400">{trips}</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(251,146,60,0.1)]">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Rating</p>
            <p className="text-4xl font-black text-amber-400">⭐ {riderMetrics.rating}</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md border border-blue-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Acceptance Rate</p>
            <p className="text-4xl font-black text-blue-400">{riderMetrics.acceptanceRate}%</p>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50 mb-6 flex items-center justify-center">
           <p className="font-mono text-rose-400 m-0 font-medium">{status}</p>
        </div>

        <div className="w-full h-80 bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative z-0 mb-6">
          <MapContainer center={[21.1458, 79.0882]} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Polyline positions={pathHistory} color="#f43f5e" weight={5} opacity={0.8} />
            <Marker position={currentLocation} icon={bikeIcon} />
          </MapContainer>
        </div>

        {/* 🚨 THE MAGIC FIX: Instantly renders orders when Partner clicks "Mark Ready" */}
        {availablePickups.length > 0 && !offer && !isDriving && (
          <div className="bg-slate-900/60 border border-rose-500/30 rounded-3xl p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-wider text-rose-400">🚨 Ready for Pickup ({availablePickups.length})</h3>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {availablePickups.map((o, idx) => (
                <div key={idx} className="bg-slate-800/80 p-5 rounded-2xl flex justify-between items-center border border-white/5 hover:border-rose-500/30 transition">
                  <div>
                    <p className="font-black text-white text-xl">{o.kitchen || o.restaurant_name || `Order ${o.id?.substring(0, 8)}`}</p>
                    <p className="text-slate-400 font-medium">{o.items || o.item_description}</p>
                    <p className="text-emerald-400 font-bold mt-2">Amount: ₹{o.total || o.amount}</p>
                    <p className="text-slate-500 text-sm">📍 {o.delivery_address || 'Delivery location'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => acceptPickup(o)} 
                      className="bg-emerald-600 hover:bg-emerald-500 px-6 py-4 rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 transition transform hover:scale-105"
                    >
                      Accept ✓
                    </button>
                    <button 
                      onClick={() => rejectPickup(o.id)} 
                      className="bg-slate-700 hover:bg-slate-600 px-4 py-4 rounded-xl font-bold text-white transition"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE OFFER / DRIVING UI */}
        {(offer || isDriving) && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(244,63,94,0.15)] relative z-10 transition-all">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>
               <h3 className="text-2xl font-bold text-white">{isDriving ? '📍 Active Delivery' : '🚨 Delivery Secured'}</h3>
            </div>
            
            <div className="bg-slate-800/50 rounded-2xl p-5 mb-8 border border-white/5">
               <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2">Order Details</p>
               <p className="text-xl font-black text-white mb-1">{offer?.kitchen}</p>
               <p className="text-slate-300 font-medium mb-4">{offer?.items}</p>
               <div className="pt-4 border-t border-white/10 flex justify-between">
                 <span className="text-slate-400 font-medium">Customer Paid:</span>
                 <span className="text-emerald-400 font-black">{offer?.total}</span>
               </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {!isDriving ? (
                <>
                  <button onClick={startDriving} className="flex-1 bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-1 text-lg">
                    Start Driving 🛵
                  </button>
                  <button onClick={rejectOrder} className="px-8 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-2xl shadow-lg transition">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={completeDelivery} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/25 transition transform hover:-translate-y-1 text-lg">
                  ✅ Complete Delivery
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}