import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiService } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// ─── Icons ────────────────────────────────────────────────────────────────────
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1986/1986937.png',
  iconSize: [40, 40], iconAnchor: [20, 20],
});

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const EarningsTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm shadow-xl">
        <p className="text-slate-400">{label}</p>
        <p className="text-emerald-400 font-black">₹{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

// ─── Countdown Ring Component ─────────────────────────────────────────────────
function CountdownRing({ seconds, total }) {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const progress = seconds / total;
  const dashOffset = circumference * (1 - progress);
  const color = seconds > total * 0.5 ? '#34d399' : seconds > total * 0.2 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 ring-countdown" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(71,85,105,0.3)" strokeWidth="6" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black tabular-nums" style={{ color }}>{seconds}</span>
        <span className="text-[9px] text-slate-400 font-bold uppercase">secs</span>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color, icon, sub }) {
  const colorMap = { emerald: 'emerald', rose: 'rose', amber: 'amber', blue: 'blue' };
  const c = colorMap[color] || 'emerald';
  return (
    <div className={`bg-slate-900/60 backdrop-blur-md border border-${c}-500/20 rounded-3xl p-5 shadow-lg hover:-translate-y-0.5 transition-all duration-200 group`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-black text-${c}-400`}>
        {unit === 'prefix' ? `₹${value}` : value}{unit && unit !== 'prefix' ? unit : ''}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RiderScreen({ goBack, globalOrders, updateGlobalOrderStatus }) {
  const [email, setEmail] = useState('harsh01@gmail.com');
  const [riderId, setRiderId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'history'
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
  const [isOnline, setIsOnline] = useState(true);
  const [weeklyEarnings, setWeeklyEarnings] = useState([
    { day: 'Mon', amount: 0 }, { day: 'Tue', amount: 0 }, { day: 'Wed', amount: 0 },
    { day: 'Thu', amount: 0 }, { day: 'Fri', amount: 0 }, { day: 'Sat', amount: 0 }, { day: 'Sun', amount: 0 },
  ]);
  const [tripHistory, setTripHistory] = useState([]);
  const [streak, setStreak] = useState(0);
  const [dailyGoal] = useState(800);
  const [acceptTimer, setAcceptTimer] = useState(null);
  const [topOfferTimer, setTopOfferTimer] = useState(0);

  const wsRef = useRef(null);
  const driveInterval = useRef(null);
  const metricsInterval = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected');

  const availablePickups = [
    ...dbAvailableOrders,
    ...(globalOrders || []).filter(go => go.status === 'ready' && !dbAvailableOrders.find(d => d.id === go.id))
  ];

  // Auto-accept countdown for top offer
  useEffect(() => {
    if (!availablePickups.length || offer || isDriving) { setTopOfferTimer(0); return; }
    setTopOfferTimer(15);
    const iv = setInterval(() => {
      setTopOfferTimer(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [availablePickups.length, offer, isDriving]);

  const fetchEarnings = async (id) => {
    try {
      const data = await apiService.getRiderEarnings(id);
      setEarnings(data.total_earnings || 0);
      setTrips(data.completed_trips || 0);
      // Use real weekly earnings from backend
      if (data.weekly_earnings && data.weekly_earnings.length > 0) {
        setWeeklyEarnings(data.weekly_earnings);
      }
      // Use real trip history from backend
      if (data.trip_history && data.trip_history.length > 0) {
        setTripHistory(data.trip_history);
      }
    } catch(e) {
      console.error('Failed to fetch earnings:', e);
    }
  };

  const fetchRiderMetrics = async (id) => {
    const metrics = await apiService.getRiderMetrics(id);
    if (metrics) {
      setRiderMetrics(metrics);
      if (metrics.streak !== undefined) setStreak(metrics.streak);
    }
  };

  const handleLogin = async () => {
    setStatus('⏳ Authenticating...');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/riders/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) {
        const data = await res.json();
        setRiderId(data.rider_id);
        setIsLoggedIn(true);
        fetchEarnings(data.rider_id);
      } else setStatus('❌ Rider not found.');
    } catch { setStatus('❌ Server error.'); }
  };

  useEffect(() => {
    if (!isLoggedIn || !riderId) return;
    wsRef.current = apiService.connectRiderWS(riderId,
      (data) => {
        if (data.type === 'metrics_update') setRiderMetrics(data.metrics);
        if (['new_order_offer','order_ready_for_pickup','food_ready'].includes(data.type)) {
          setStatus('🔔 New order nearby!');
          try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch {}
          apiService.getAvailableOrdersForRider().then(orders => setDbAvailableOrders(orders));
        }
      },
      (s) => {
        setWsStatus(s);
        if (s === 'connected') { setStatus('🟢 ONLINE: Scanning for orders...'); fetchRiderMetrics(riderId); }
      }
    );
    fetchRiderMetrics(riderId);
    metricsInterval.current = setInterval(() => { fetchRiderMetrics(riderId); fetchEarnings(riderId); }, 30000);
    const fetchAvailable = async () => { const o = await apiService.getAvailableOrdersForRider(); setDbAvailableOrders(o); };
    fetchAvailable();
    const pollIv = setInterval(fetchAvailable, 5000);
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (driveInterval.current) clearInterval(driveInterval.current);
      if (metricsInterval.current) clearInterval(metricsInterval.current);
      clearInterval(pollIv);
    };
  }, [isLoggedIn, riderId]);

  const acceptPickup = async (order) => {
    setStatus('🚨 Accepting...');
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${order.id}/rider/accept?rider_id=${riderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        setOffer(order);
        setStatus('🎯 Order accepted! Ready to deliver.');
        try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch {}
        if (updateGlobalOrderStatus) updateGlobalOrderStatus(order.id, 'assigned', { rider_id: riderId, rider_name: email.split('@')[0] });
      } else setStatus('❌ Failed to accept');
    } catch { setStatus('❌ Error'); }
    setTimeout(() => setStatus(isOnline ? '🟢 ONLINE: Scanning...' : '🔴 OFFLINE'), 3000);
  };

  const rejectPickup = async (orderId) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/v1/orders/${orderId}/rider/reject?rider_id=${riderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      setStatus('✋ Order rejected');
      setTimeout(() => setStatus(isOnline ? '🟢 ONLINE: Scanning...' : ''), 2000);
    } catch {}
  };

  const startDriving = async () => {
    if (!offer) return;
    try {
      await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.id}/in-delivery`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
    } catch {}
    const startLat = 21.1458, startLng = 79.0882, endLat = 21.1558, endLng = 79.0782, steps = 20;
    const route = Array.from({ length: steps + 1 }, (_, i) => [
      startLat + (endLat - startLat) * (i / steps) + (Math.random() - 0.5) * 0.001,
      startLng + (endLng - startLng) * (i / steps) + (Math.random() - 0.5) * 0.001
    ]);
    setFullRoute(route); setPathHistory([route[0]]); setIsDriving(true); setStatus('🛵 IN TRANSIT: Navigating...');
    let idx = 0;
    driveInterval.current = setInterval(async () => {
      if (idx >= route.length) { clearInterval(driveInterval.current); setStatus('📍 Arrived! Tap Complete.'); return; }
      const pt = route[idx];
      setCurrentLocation(pt); setPathHistory(prev => [...prev, pt]);
      if (updateGlobalOrderStatus) updateGlobalOrderStatus(offer.id, 'in_delivery', { rider_location: { lat: pt[0], lng: pt[1] } });
      idx++;
    }, 500);
  };

  const completeDelivery = async () => {
    if (!offer) return;
    clearInterval(driveInterval.current);
    setStatus('⏳ Finalizing...');
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.id}/complete-delivery`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        if (updateGlobalOrderStatus) updateGlobalOrderStatus(offer.id, 'delivered');
        // We just completed an order, fetch real updated earnings and metrics
        await fetchEarnings(riderId);
        await fetchRiderMetrics(riderId);
        setIsDriving(false); setOffer(null); setPathHistory([[21.1458, 79.0882]]);
        setStatus('✅ Delivered! Scanning for next order...');
      } else setStatus('❌ Failed to complete');
    } catch { setStatus('❌ Error'); }
    setTimeout(() => setStatus('🟢 ONLINE: Scanning...'), 3000);
  };

  const rejectOrder = async () => {
    if (offer) { try { await rejectPickup(offer.id); } catch {} }
    setOffer(null); setStatus('✋ Cancelled. Waiting...');
    setTimeout(() => setStatus('🟢 ONLINE: Scanning...'), 2000);
  };

  const progressPct = Math.min(100, Math.round((earnings / dailyGoal) * 100));
  const weekTotal = weeklyEarnings.reduce((a, b) => a + b.amount, 0);

  // ── LOGIN GATE ──
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white flex items-center justify-center font-sans p-6">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/10 text-center animate-fade-in-up">
          <button onClick={goBack} className="text-rose-400 hover:text-rose-300 font-semibold mb-6 block text-left">← Back</button>
          <div className="text-7xl mb-6">🛵</div>
          <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Rider Portal</h2>
          <p className="text-slate-400 text-sm mb-8">Go online to start earning with LocalBite</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-rose-500 outline-none mb-4 text-center text-lg" placeholder="Your rider email" />
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-1 text-lg">
            Go Online 🛵
          </button>
          {status.includes('❌') && <p className="mt-4 text-rose-300 text-sm">{status}</p>}
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white font-sans">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-white/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center font-black text-white">
            {email[0].toUpperCase()}
          </div>
          <div>
            <p className="font-black text-white text-sm leading-tight">{email.split('@')[0]}</p>
            <div className={`text-[10px] font-bold ${wsStatus === 'connected' ? 'text-emerald-400' : 'text-slate-400'}`}>
              {wsStatus === 'connected' ? '🟢 Online' : '🟡 Connecting...'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Online/Offline toggle */}
          <button onClick={() => { setIsOnline(!isOnline); setStatus(!isOnline ? '🟢 ONLINE: Scanning...' : '🔴 OFFLINE'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition border ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600/30'}`}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
          <button onClick={() => { setIsLoggedIn(false); setRiderId(''); }} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-xl transition text-xs font-bold">Out</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/5 bg-slate-900/50">
        {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'history', icon: '📋', label: 'Trip History' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'text-rose-400 border-b-2 border-rose-400' : 'text-slate-500 hover:text-slate-300'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-5">

        {/* ═══ DASHBOARD TAB ═══ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Streak Banner */}
            {streak > 0 && (
              <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/20 border border-amber-500/30 rounded-2xl px-5 py-3 flex items-center gap-3 animate-slide-down">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="font-black text-amber-400 text-sm">{streak}-Day Delivery Streak!</p>
                  <p className="text-xs text-slate-400">Keep it up — {7 - streak} more days for bonus!</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className={`w-4 h-4 rounded-sm ${i < streak ? 'bg-amber-400' : 'bg-slate-700'}`} />
                  ))}
                </div>
              </div>
            )}

            {/* Stat Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Today's Earnings" value={earnings} unit="prefix" color="emerald" icon="💰" sub={`Goal: ₹${dailyGoal}`} />
              <StatCard label="Completed Trips" value={trips} color="rose" icon="🏁" sub="Total this session" />
              <StatCard label="Rating" value={`⭐ ${riderMetrics.rating}`} color="amber" icon="⭐" sub="Based on all rides" />
              <StatCard label="Acceptance Rate" value={riderMetrics.acceptanceRate} unit="%" color="blue" icon="📈" sub="Keep above 85%" />
            </div>

            {/* Daily Goal Progress */}
            <div className="bg-slate-900/60 border border-emerald-500/20 rounded-3xl p-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Daily Goal</p>
                  <p className="text-white font-black">₹{earnings} <span className="text-slate-500 font-semibold text-sm">/ ₹{dailyGoal}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-emerald-400">{progressPct}%</p>
                  <p className="text-xs text-slate-500">{progressPct >= 100 ? '🎉 Goal reached!' : `₹${dailyGoal - earnings} remaining`}</p>
                </div>
              </div>
              <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full progress-bar-fill shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                  style={{ '--progress-width': `${progressPct}%`, width: `${progressPct}%` }} />
              </div>
            </div>

            {/* Status Bar */}
            <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/40 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
              <p className="font-mono text-rose-300 text-sm font-medium">{status}</p>
            </div>

            {/* Map */}
            <div className="w-full h-72 bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
              <MapContainer center={[21.1458, 79.0882]} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; Carto' />
                {pathHistory.length > 1 && <Polyline positions={pathHistory} color="#f43f5e" weight={5} opacity={0.8} />}
                {fullRoute.length > 0 && <Polyline positions={fullRoute} color="rgba(244,63,94,0.2)" weight={3} dashArray="6,6" />}
                <Marker position={currentLocation} icon={bikeIcon} />
              </MapContainer>
              {/* Overlay: ETA when driving */}
              {isDriving && (
                <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 z-10">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Est. Arrival</p>
                  <p className="text-rose-400 font-black text-lg">~{Math.ceil(fullRoute.length * 0.5 / 60)} min</p>
                </div>
              )}
            </div>

            {/* Available Pickups */}
            {availablePickups.length > 0 && !offer && !isDriving && (
              <div className="bg-slate-900/60 border border-rose-500/20 rounded-3xl p-5 animate-slide-down">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-rose-400 font-black uppercase tracking-wider text-sm">🚨 Ready Pickups ({availablePickups.length})</h3>
                  {topOfferTimer > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Auto-expires in</span>
                      <CountdownRing seconds={topOfferTimer} total={15} />
                    </div>
                  )}
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {availablePickups.map((o, idx) => (
                    <div key={idx} className={`bg-slate-800/80 p-4 rounded-2xl border transition ${idx === 0 ? 'border-rose-500/30 shadow-lg shadow-rose-500/5' : 'border-white/5 hover:border-rose-500/20'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-black text-white text-base truncate">{o.kitchen || o.restaurant_name || `Order ${o.id?.substring(0, 8)}`}</p>
                          <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{o.items || o.item_description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-400 font-black">₹{o.total || o.amount}</p>
                          <p className="text-xs text-slate-500">~{Math.floor(Math.random() * 15 + 5)} min</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span>📍</span>
                          <span className="truncate max-w-[160px]">{o.delivery_address || '1.2 km away'}</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => acceptPickup(o)} className="bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-xl font-black text-white text-sm shadow-lg shadow-emerald-500/20 transition transform hover:scale-105">
                            Accept ✓
                          </button>
                          <button onClick={() => rejectPickup(o.id)} className="bg-slate-700 hover:bg-slate-600 px-3 py-2.5 rounded-xl font-bold text-white text-sm transition">
                            ✗
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Delivery */}
            {(offer || isDriving) && (
              <div className="bg-slate-900/60 border border-rose-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(244,63,94,0.1)] animate-slide-down">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                  <h3 className="text-xl font-black text-white">{isDriving ? '📍 Active Delivery' : '🚨 Order Secured'}</h3>
                </div>

                {/* Order Info */}
                <div className="bg-slate-800/50 rounded-2xl p-4 mb-5 border border-white/5 space-y-2">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pickup From</p>
                  <p className="text-xl font-black text-white">{offer?.kitchen || offer?.restaurant_name}</p>
                  <p className="text-slate-300 text-sm">{offer?.items || offer?.item_description}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-slate-400 text-sm">Customer Paid:</span>
                    <span className="text-emerald-400 font-black text-lg">{offer?.total || `₹${offer?.amount}`}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Your Earnings:</span>
                    <span className="text-rose-400 font-black">₹{Math.floor(((offer?.amount || 50) * 0.15) + 30)}</span>
                  </div>
                </div>

                {/* Customer Contact (mock) */}
                {isDriving && (
                  <div className="flex items-center gap-3 bg-slate-800/40 rounded-xl p-3 border border-white/5 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-slate-950">C</div>
                    <div className="flex-1"><p className="font-bold text-white text-sm">Customer</p><p className="text-xs text-slate-400">+91 ••••••1234</p></div>
                    <div className="flex gap-2">
                      <button className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition">📞</button>
                      <button className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-600 transition">💬</button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  {!isDriving ? (
                    <>
                      <button onClick={startDriving} className="flex-1 bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-500/20 transition transform hover:-translate-y-0.5 text-lg">
                        Start Driving 🛵
                      </button>
                      <button onClick={rejectOrder} className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition">Cancel</button>
                    </>
                  ) : (
                    <button onClick={completeDelivery} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition transform hover:-translate-y-0.5 text-lg">
                      ✅ Complete Delivery
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* No orders available */}
            {availablePickups.length === 0 && !offer && !isDriving && isOnline && (
              <div className="text-center bg-slate-900/40 rounded-3xl border border-white/5 py-12">
                <div className="text-5xl mb-4 opacity-40">📡</div>
                <p className="text-slate-400 font-bold">Scanning for orders...</p>
                <p className="text-slate-500 text-sm mt-1">You'll hear a sound when a new order is ready</p>
                <div className="flex justify-center gap-1 mt-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-rose-500/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ TRIP HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <div className="space-y-5 animate-fade-in">

            {/* Weekly Chart */}
            <div className="bg-slate-900/60 rounded-3xl p-5 border border-white/5">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-black text-white text-lg">Weekly Earnings</h3>
                  <p className="text-xs text-slate-400 mt-0.5">₹{weekTotal.toLocaleString()} total this week</p>
                </div>
                <span className="text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full font-bold">This Week</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyEarnings} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} width={45} />
                  <Tooltip content={<EarningsTooltip />} cursor={{ fill: 'rgba(244,63,94,0.05)' }} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="url(#riderGrad)" />
                  <defs>
                    <linearGradient id="riderGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Earnings Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[{ label: 'Base Pay', v: `₹${Math.floor(weekTotal * 0.7)}` }, { label: 'Surge Bonus', v: `₹${Math.floor(weekTotal * 0.2)}` }, { label: 'Tips', v: `₹${Math.floor(weekTotal * 0.1)}` }].map((s, i) => (
                <div key={i} className="bg-slate-900/60 border border-white/5 rounded-2xl p-3 text-center">
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="font-black text-white">{s.v}</p>
                </div>
              ))}
            </div>

            {/* Trip List */}
            <div>
              <h3 className="font-black text-white text-lg mb-4">Recent Trips</h3>
              {tripHistory.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-5xl mb-4 opacity-30">🏁</div>
                  <p className="text-slate-400 font-bold">No trips yet</p>
                  <p className="text-slate-500 text-sm mt-1">Complete a delivery to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tripHistory.map((trip, i) => (
                    <div key={trip.id} className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-rose-500/20 transition animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-lg shrink-0">🛵</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-sm truncate">{trip.from} → {trip.to}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{trip.timestamp} · {trip.time}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-emerald-400">+₹{trip.amount}</p>
                        <p className="text-[10px] text-emerald-400/60 font-bold">{trip.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}