import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE, apiService } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm shadow-xl">
        <p className="text-slate-400 font-medium">{label}</p>
        <p className="text-emerald-400 font-black">₹{payload[0]?.value || payload[0]?.value === 0 ? payload[0].value : ''}</p>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-white font-bold">{payload[0].name}</p>
        <p className="text-emerald-400 font-black">{payload[0].value} orders</p>
      </div>
    );
  }
  return null;
};

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ item, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm animate-bounce-in">
        <div className="text-4xl text-center mb-3">⚠️</div>
        <h3 className="text-lg font-black text-white text-center mb-2">Delete "{item?.name}"?</h3>
        <p className="text-slate-400 text-sm text-center mb-6">This item will be removed from your menu permanently.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-black hover:bg-rose-400 transition">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
const STAT_GRADIENTS = {
  emerald: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/40',
  amber:   'from-amber-500/10  to-orange-500/5 border-amber-500/20   hover:border-amber-500/40',
  rose:    'from-rose-500/10   to-pink-500/5   border-rose-500/20    hover:border-rose-500/40',
  blue:    'from-blue-500/10   to-cyan-500/5   border-blue-500/20    hover:border-blue-500/40',
};
const STAT_TEXT = { emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400', blue: 'text-blue-400' };

function StatCard({ label, value, sub, color = 'emerald', icon, animate }) {
  const grad = STAT_GRADIENTS[color] || STAT_GRADIENTS.emerald;
  const txt  = STAT_TEXT[color] || STAT_TEXT.emerald;
  return (
    <div className={`bg-gradient-to-br ${grad} p-5 rounded-2xl border shadow-lg hover:-translate-y-1 transition-all duration-200 group relative overflow-hidden`}>
      {/* Background icon */}
      <div className="absolute -bottom-2 -right-2 text-6xl opacity-5 group-hover:opacity-10 transition-opacity duration-300 select-none">{icon}</div>
      <div className="flex items-start justify-between mb-4">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg bg-white/5 border border-white/8`}>{icon}</div>
      </div>
      <p className={`text-3xl font-black ${txt} ${animate ? 'animate-count-up' : ''} mb-1`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 font-medium">{sub}</p>}
    </div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ order, onAction, actionLabel, actionColor }) {
  const timeAgo = order.time || 'Recently';
  const rawDesc = order.item_description || order.items || '';
  const isGroupOrder = rawDesc.startsWith('[GROUP ORDER');
  // Strip the prefix for a cleaner display inside the card
  const cleanDesc = isGroupOrder ? rawDesc.replace(/^\[GROUP ORDER ×\d+\]\s*/, '') : rawDesc;

  return (
    <div className={`kanban-card rounded-2xl p-4 mb-3 transition group ${
      isGroupOrder
        ? 'bg-violet-900/20 border border-violet-500/30 hover:border-violet-400/50'
        : 'bg-slate-900/80 border border-white/5 hover:border-amber-500/20'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-xs font-mono text-slate-500">{order.id?.slice(0, 8) || 'N/A'}</p>
            {isGroupOrder && (
              <span className="text-[9px] bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
                👥 Split Bill
              </span>
            )}
          </div>
          <p className="font-bold text-white text-sm mt-0.5 line-clamp-2">{cleanDesc}</p>
        </div>
        <span className="text-xs text-slate-500 shrink-0 ml-2">{timeAgo}</span>
      </div>
      <div className="flex justify-between items-center">
        <div>
          <p className={`font-black text-lg ${isGroupOrder ? 'text-violet-300' : 'text-amber-400'}`}>
            {order.amount ? `₹${order.amount}` : order.total}
          </p>
          {isGroupOrder && <p className="text-[10px] text-violet-400/70 font-bold">Full group total</p>}
        </div>
        {onAction && (
          <button onClick={() => onAction(order.id)}
            className={`text-xs font-black px-4 py-2 rounded-xl transition transform hover:scale-105 ${
              actionColor === 'green' ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
              actionColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20' :
              'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20'
            }`}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PartnerScreen({ goBack, globalOrders = [], updateGlobalOrderStatus }) {
  const [email, setEmail] = useState('spice.route@gmail.com');
  const [partnerId, setPartnerId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [orders, setOrders] = useState([]);
  const [dynamicStats, setDynamicStats] = useState({ revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0 });
  const [weeklyRevenue, setWeeklyRevenue] = useState([
    { day: 'Mon', revenue: 0 }, { day: 'Tue', revenue: 0 }, { day: 'Wed', revenue: 0 },
    { day: 'Thu', revenue: 0 }, { day: 'Fri', revenue: 0 }, { day: 'Sat', revenue: 0 }, { day: 'Sun', revenue: 0 },
  ]);
  const wsRef = useRef(null);
  const refreshInterval = useRef(null);
  const [wsStatus, setWsStatus] = useState('disconnected');

  const [restName, setRestName] = useState('The Spice Route');
  const [restDesc, setRestDesc] = useState('Authentic North Indian cuisine.');
  const [restAddr, setRestAddr] = useState('123 Food Street, Nagpur');
  const [restImg, setRestImg] = useState('https://images.unsplash.com/photo-1589302168068-964664d93cb0?w=500&q=80');

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCat, setItemCat] = useState('');
  const [itemImg, setItemImg] = useState('');
  const [itemInStock, setItemInStock] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuPreview, setMenuPreview] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // ── Custom Promo Codes ──
  const [promoCodes, setPromoCodes] = useState([
    { code: 'SPICE20', discount: 20, minOrder: 200, active: true, uses: 14 },
    { code: 'FRIDAY10', discount: 10, minOrder: 100, active: true, uses: 37 },
  ]);
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState('');
  const [newPromoMin, setNewPromoMin] = useState('');

  // ── QR Code Upload ──
  const [partnerQRCode, setPartnerQRCode] = useState(null);
  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => setPartnerQRCode(reader.result); reader.readAsDataURL(file); }
  };

  // Settings tab state
  const [settingsRestName, setSettingsRestName] = useState('');
  const [settingsRestDesc, setSettingsRestDesc] = useState('');
  const [settingsRestAddr, setSettingsRestAddr] = useState('');
  const [settingsRestContact, setSettingsRestContact] = useState('');
  const [settingsRestSupport, setSettingsRestSupport] = useState('');
  const [operatingHours, setOperatingHours] = useState({
    Mon: { open: true, start: '09:00', end: '22:00' },
    Tue: { open: true, start: '09:00', end: '22:00' },
    Wed: { open: true, start: '09:00', end: '22:00' },
    Thu: { open: true, start: '09:00', end: '22:00' },
    Fri: { open: true, start: '09:00', end: '23:00' },
    Sat: { open: true, start: '10:00', end: '23:00' },
    Sun: { open: false, start: '10:00', end: '20:00' },
  });
  const CUISINE_TAGS = ['North Indian', 'South Indian', 'Chinese', 'Italian', 'Fast Food', 'Desserts', 'Beverages', 'Healthy', 'Biryani'];
  const [selectedTags, setSelectedTags] = useState(['North Indian']);

  // Merged orders (DB + global)
  const unifiedSafeOrders = [...orders, ...globalOrders.filter(go => !orders.find(o => o.id === go.id))]
    .filter(o => {
      const orderKitchen = (o.kitchen || o.restaurant_name || '').toLowerCase().trim();
      const myKitchen = (restaurant?.name || '').toLowerCase().trim();
      if (orderKitchen && myKitchen && orderKitchen !== myKitchen) return false;
      return true;
    });

  const newOrders = unifiedSafeOrders.filter(o => o.status === 'new');
  const preparingOrders = unifiedSafeOrders.filter(o => o.status === 'accepted' || o.status === 'preparing');
  const readyOrders = unifiedSafeOrders.filter(o => o.status === 'ready');
  const completedOrders = unifiedSafeOrders.filter(o => o.status === 'completed' || o.status === 'delivered');

  // Pie data
  const pieData = [
    { name: 'Active', value: newOrders.length + preparingOrders.length },
    { name: 'Ready', value: readyOrders.length },
    { name: 'Completed', value: completedOrders.length },
  ].filter(d => d.value > 0);
  const PIE_COLORS = ['#f59e0b', '#34d399', '#10b981'];

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) { const reader = new FileReader(); reader.onloadend = () => setItemImg(reader.result); reader.readAsDataURL(file); }
  };

  const updateOrderStatus = async (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    setStatus(`⏳ Updating...`);
    try {
      let success = false;
      if (newStatus === 'accepted') success = await apiService.acceptOrderAsPartner(id, restaurant.id);
      else if (newStatus === 'preparing') success = await apiService.markOrderPreparing(id);
      else if (newStatus === 'ready') success = await apiService.markOrderReady(id);
      if (success) {
        setStatus(`✅ Order → ${newStatus}`);
        if (updateGlobalOrderStatus) updateGlobalOrderStatus(id, newStatus, { restaurant_name: restaurant.name });
        if (soundEnabled) { try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch {} }
      } else { setStatus('❌ Failed to update'); }
      setTimeout(() => fetchPartnerOrders(restaurant.id), 500);
    } catch (e) { setStatus(`❌ ${e.message}`); }
    setTimeout(() => setStatus(''), 3000);
  };

  useEffect(() => {
    return () => {
      if (refreshInterval.current) clearInterval(refreshInterval.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const toggleStore = async () => {
    if (!restaurant || !partnerId) {
      setStatus('⚠️ Please log in first.');
      setTimeout(() => setStatus(''), 3000);
      return;
    }
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    setStatus(newState ? '⏳ Opening store...' : '⏳ Closing store...');
    try {
      const res = await fetch(
        `${API_BASE}/partners/${partnerId}/restaurant/${restaurant.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_open: newState }),
        }
      );
      if (res.ok) {
        setStatus(newState ? '✅ Store ONLINE — customers can order' : '🛑 Store OFFLINE — hidden from customers');
      } else {
        // Revert on failure
        setIsStoreOpen(!newState);
        setStatus('❌ Failed to update store status.');
      }
    } catch (e) {
      setIsStoreOpen(!newState);
      setStatus('❌ Could not reach server.');
    }
    setTimeout(() => setStatus(''), 3500);
  };

  const handleLogin = async () => {
    setStatus('⏳ Authenticating...');
    try {
      const res = await fetch(`${API_BASE}/partners/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (res.ok) {
        const data = await res.json();
        setPartnerId(data.partner_id);
        if (data.restaurant) {
          setRestaurant(data.restaurant);
          setIsStoreOpen(data.restaurant.is_open !== false); // read persisted open state
          setSettingsRestName(data.restaurant.name || '');
          setSettingsRestDesc(data.restaurant.description || '');
          setSettingsRestAddr(data.restaurant.address || '');
          setSettingsRestContact(data.restaurant.contact_number || '');
          setSettingsRestSupport(data.restaurant.support_number || '');
          fetchMenu(data.restaurant.id);
          fetchPartnerOrders(data.restaurant.id);
          fetchPartnerAnalytics(data.restaurant.id);
          wsRef.current = apiService.connectPartnerWS(data.partner_id,
            (update) => {
              if (['order_placed','order_accepted','gps_update','delivery_complete','rider_assigned','delivery_started'].includes(update.type)) {
                fetchPartnerOrders(data.restaurant.id);
                fetchPartnerAnalytics(data.restaurant.id);
                if (soundEnabled && update.type === 'order_placed') { try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play(); } catch {} }
              }
            },
            (s) => setWsStatus(s)
          );
          refreshInterval.current = setInterval(() => { fetchPartnerOrders(data.restaurant.id); fetchPartnerAnalytics(data.restaurant.id); }, 10000);
        }
        setStatus('');
      } else setStatus('❌ Login failed.');
    } catch { setStatus('❌ Server connection failed.'); }
  };

  const fetchPartnerOrders = async (restaurantId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/orders`);
      if (res.ok) { const data = await res.json(); setOrders(data || []); }
    } catch { setOrders([]); }
  };

  const fetchPartnerAnalytics = async (restaurantId) => {
    const analytics = await apiService.getPartnerAnalytics(restaurantId);
    // Use real weekly data from backend
    if (analytics.weeklyRevenue && analytics.weeklyRevenue.length > 0) {
      setWeeklyRevenue(analytics.weeklyRevenue);
    }
    setDynamicStats({
      revenue: analytics.revenue || 0,
      activeOrders: analytics.activeOrders ?? unifiedSafeOrders.filter(o => ['new','preparing'].includes(o.status)).length,
      completedToday: analytics.completedToday || 0,
      avgRating: analytics.avgRating || 4.0,
    });
  };

  const createRestaurant = async () => {
    setStatus('⏳ Registering Kitchen...');
    try {
      const res = await fetch(`${API_BASE}/partners/${partnerId}/restaurant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: restName, description: restDesc, address: restAddr, latitude: 21.1458, longitude: 79.0882, image_url: restImg }) });
      if (res.ok) { const data = await res.json(); setRestaurant(data); setStatus(''); }
    } catch { setStatus('❌ Failed.'); }
  };

  const fetchMenu = async (restId) => {
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restId}/menu`);
      if (res.ok) setMenuItems(await res.json());
    } catch {}
  };

  const addMenuItem = async () => {
    if (!itemName || !itemPrice || !itemCat) return setStatus('⚠️ Fill all required fields');
    setStatus('⏳ Publishing...');
    try {
      const res = await fetch(`${API_BASE}/partners/restaurant/${restaurant.id}/menu`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: itemName, description: 'Freshly prepared.', price: parseFloat(itemPrice), category: itemCat, image_url: itemImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80', in_stock: itemInStock }) });
      if (res.ok) { setStatus('✅ Menu updated!'); setItemName(''); setItemPrice(''); setItemCat(''); setItemImg(''); setItemInStock(true); const fi = document.getElementById('dish-image-upload'); if (fi) fi.value = ''; fetchMenu(restaurant.id); setTimeout(() => setStatus(''), 3000); }
    } catch { setStatus('❌ Failed.'); }
  };

  const deleteMenuItem = async (item) => {
    // Call real DELETE API
    const success = await apiService.deleteMenuItem(restaurant.id, item.id);
    if (success) {
      setMenuItems(prev => prev.filter(i => i.id !== item.id));
      setStatus('✅ Item removed from menu');
    } else {
      setStatus('❌ Delete failed');
    }
    setDeleteTarget(null);
    setTimeout(() => setStatus(''), 3000);
  };

  const toggleStockForItem = async (item) => {
    const newVal = !item.is_available;
    // Optimistic update
    setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: newVal, in_stock: newVal } : i));
    await apiService.updateMenuItem(restaurant.id, item.id, { is_available: newVal });
  };

  const saveRestaurantSettings = async () => {
    setStatus('⏳ Saving...');
    const result = await apiService.updateRestaurant(partnerId, restaurant.id, {
      name: settingsRestName,
      description: settingsRestDesc,
      address: settingsRestAddr,
      contact_number: settingsRestContact,
      support_number: settingsRestSupport,
    });
    if (result) {
      setRestaurant(prev => ({ ...prev, name: settingsRestName, description: settingsRestDesc, address: settingsRestAddr }));
      setStatus('✅ Profile saved!');
    } else {
      setStatus('❌ Save failed');
    }
    setTimeout(() => setStatus(''), 3000);
  };

  const topItems = [...menuItems].sort((a, b) => (b.orders_count || 0) - (a.orders_count || 0)).slice(0, 5);

  // ── LOGIN GATE ──
  if (!partnerId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white flex items-center justify-center font-sans p-6">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/10 text-center animate-fade-in-up">
          <button onClick={goBack} className="text-amber-400 hover:text-amber-300 font-semibold mb-8 block text-left">← Back</button>
          <div className="text-7xl mb-6">👨‍🍳</div>
          <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Partner Hub</h2>
          <p className="text-slate-400 text-sm mb-8">Manage your kitchen & orders in real time</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-amber-500 outline-none mb-4 text-center" placeholder="Restaurant Email" />
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/25 transition transform hover:-translate-y-1 text-lg">
            Enter Dashboard →
          </button>
          {status && <p className="mt-4 text-amber-300 text-sm animate-fade-in">{status}</p>}
        </div>
      </div>
    );
  }

  // ── REGISTER RESTAURANT ──
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-white p-6 flex items-center justify-center font-sans">
        <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-md p-10 rounded-3xl border border-amber-500/30 shadow-2xl animate-fade-in-up">
          <h2 className="text-3xl font-black mb-2 text-amber-400">Register Your Kitchen</h2>
          <p className="text-slate-400 mb-8">Set up your restaurant profile to start receiving orders.</p>
          <div className="flex flex-col gap-5">
            {[{ v: restName, s: setRestName, p: 'Restaurant Name' }, { v: restDesc, s: setRestDesc, p: 'Description (e.g. Indian, Chinese)' }, { v: restAddr, s: setRestAddr, p: 'Complete Address' }, { v: restContact, s: setRestContact, p: 'Contact Number' }].map((f, i) => (
              <input key={i} type="text" value={f.v} onChange={e => f.s(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-white focus:ring-2 focus:ring-amber-500 outline-none transition" placeholder={f.p} />
            ))}
            <button onClick={registerRestaurant} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-500/25 transition transform hover:-translate-y-1 text-lg mt-2">
              Open Restaurant →
            </button>
            {status && <p className="mt-2 text-amber-300 text-sm font-semibold">{status}</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <div className="w-16 md:w-60 xl:w-64 bg-slate-900/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-screen shrink-0 transition-all duration-300">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5 hidden md:block">
          <p className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-1">Partner Portal</p>
          <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 truncate leading-tight">{restaurant.name}</h2>
          <p className="text-[10px] text-slate-600 mt-0.5 truncate">{restaurant.address}</p>
        </div>
        {/* Mobile logo (icon only) */}
        <div className="flex items-center justify-center py-4 md:hidden border-b border-white/5">
          <span className="text-2xl">🍳</span>
        </div>

        <div className="flex flex-col gap-1 flex-grow p-2 overflow-y-auto">
          {[
            { id: 'overview', icon: '📊', label: 'Overview' },
            { id: 'orders',   icon: '🧾', label: 'Live Orders', badge: newOrders.length },
            { id: 'kanban',   icon: '📋', label: 'Kanban Board' },
            { id: 'menu',     icon: '🍲', label: 'Menu Manager' },
            { id: 'promos',   icon: '🎟️', label: 'Promos' },
            { id: 'settings', icon: '⚙️', label: 'Settings' },
            { id: 'earnings', icon: '💰', label: 'Earnings' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative p-3 rounded-xl flex items-center justify-center md:justify-between font-semibold transition-all duration-200 group ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/5 text-amber-400 border border-amber-500/25 shadow-sm'
                  : 'text-slate-500 hover:bg-white/4 hover:text-slate-200'
              }`}>
              <span className="flex items-center gap-3">
                <span className="text-xl leading-none">{tab.icon}</span>
                <span className="hidden md:inline text-sm">{tab.label}</span>
              </span>
              {tab.badge > 0 && (
                <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse min-w-[1.25rem] text-center">
                  {tab.badge}
                </span>
              )}
              {/* Active indicator */}
              {activeTab === tab.id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-r-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-white/5">
          <button
            onClick={() => { setPartnerId(null); setRestaurant(null); }}
            className="w-full p-3 rounded-xl text-slate-600 hover:text-rose-400 hover:bg-rose-500/8 transition-all font-semibold flex items-center justify-center md:justify-start gap-3 text-sm"
          >
            <span className="text-lg">🚪</span>
            <span className="hidden md:inline">Log Out</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">

        {/* Top Bar */}
        <div className="sticky top-0 z-20 bg-[#0a0f1e]/90 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3.5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-black capitalize hidden sm:block truncate">
              {activeTab === 'kanban' ? 'Kanban Board' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h1>
            {status && (
              <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 animate-pulse shrink-0">
                {status}
              </span>
            )}
            <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold border ${
              wsStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-slate-700/30 text-slate-500 border-slate-600/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {wsStatus === 'connected' ? 'Live' : 'Connecting'}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Sound toggle */}
            <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition ${
              soundEnabled ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-500 border border-white/5'
            }`}>
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            {/* Store Open/Close toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium hidden sm:block">Store:</span>
              <button onClick={toggleStore} className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-inner ${isStoreOpen ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-200 ${isStoreOpen ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className={`font-black text-xs hidden sm:block ${isStoreOpen ? 'text-emerald-400' : 'text-slate-500'}`}>{isStoreOpen ? 'OPEN' : 'CLOSED'}</span>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1">

          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Today's Revenue" value={`₹${dynamicStats.revenue}`} sub="From all completed orders" color="emerald" icon="💰" animate />
                <StatCard label="Active Orders" value={dynamicStats.activeOrders} sub={`${newOrders.length} new · ${preparingOrders.length} preparing`} color="amber" icon="🔥" animate />
                <StatCard label="Completed Today" value={dynamicStats.completedToday} sub="Successfully delivered" color="blue" icon="✅" animate />
                <StatCard label="Avg Rating" value={`⭐ ${dynamicStats.avgRating}`} sub="Based on customer reviews" color="amber" icon="⭐" animate />
              </div>

              {/* Charts Row */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Revenue Bar Chart */}
                <div className="lg:col-span-2 bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-black text-white text-lg">Weekly Revenue</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Last 7 days earnings overview</p>
                    </div>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">This Week</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyRevenue} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} width={50} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.05)' }} />
                      <Bar dataKey="revenue" radius={[6,6,0,0]}
                        fill="url(#revenueGrad)" />
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Order Status Pie */}
                <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                  <h3 className="font-black text-white text-lg mb-1">Order Mix</h3>
                  <p className="text-xs text-slate-400 mb-5">Current order distribution</p>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-3">
                        {pieData.map((d, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} /><span className="text-slate-400">{d.name}</span></div>
                            <span className="font-black text-white">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-[150px] flex items-center justify-center text-slate-500 text-sm">No order data yet</div>
                  )}
                </div>
              </div>

              {/* Top Selling Items */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                <h3 className="font-black text-white text-lg mb-5">Top Selling Items</h3>
                {topItems.length > 0 ? (
                  <div className="space-y-3">
                    {topItems.map((item, i) => (
                      <div key={item.id || i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-700/30 transition">
                        <span className="text-2xl font-black text-amber-400 w-8 text-center">#{i + 1}</span>
                        {item.image_url && <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.category}</p>
                        </div>
                        <p className="font-black text-emerald-400">₹{item.price}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {menuItems.slice(0, 4).map((item, i) => (
                      <div key={item.id || i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-700/30 transition">
                        <span className="text-2xl font-black text-amber-400 w-8 text-center">#{i + 1}</span>
                        {item.image_url && <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />}
                        <div className="flex-1"><p className="font-bold text-white">{item.name}</p><p className="text-xs text-slate-400">{item.category}</p></div>
                        <p className="font-black text-emerald-400">₹{item.price}</p>
                      </div>
                    ))}
                    {menuItems.length === 0 && <p className="text-slate-500 text-center py-4">Add items to your menu to see top sellers</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ ORDERS LIST TAB ═══ */}
          {activeTab === 'orders' && (
            <div className="animate-fade-in">
              <div className="flex gap-3 mb-6 border-b border-white/10 pb-4 overflow-x-auto chips-row">
                {[
                  { id: 'active', label: `Active (${unifiedSafeOrders.filter(o => ['new','accepted','preparing','ready','assigned','in_delivery'].includes(o.status)).length})` },
                  { id: 'completed', label: `Completed (${completedOrders.length})` },
                  { id: 'cancelled', label: 'Cancelled' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(`orders_${tab.id}`)}
                    className="shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-4">
                {unifiedSafeOrders.filter(o => ['new','accepted','preparing','ready','assigned','in_delivery'].includes(o.status)).map(order => (
                  <div key={order.id} className="bg-slate-800/50 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-amber-500/30 transition animate-fade-in">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${order.status === 'new' ? 'bg-rose-400 animate-pulse' : order.status === 'preparing' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                        <h3 className="font-mono text-sm text-slate-400">#{order.id?.slice(0, 8)}</h3>
                        <span className="text-slate-500 text-xs">· {order.time || 'Recently'}</span>
                      </div>
                      <p className="text-amber-400 font-bold mb-1">{order.item_description || order.items}</p>
                      <p className="text-white font-black">{order.amount ? `₹${order.amount}` : order.total}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'new' && <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-5 rounded-xl transition shadow-lg shadow-emerald-500/20">Accept ✓</button>}
                      {order.status === 'accepted' && <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2.5 px-5 rounded-xl transition">Start Preparing 👨‍🍳</button>}
                      {order.status === 'preparing' && <button onClick={() => updateOrderStatus(order.id, 'ready')} className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2.5 px-5 rounded-xl transition">Mark Ready ✓</button>}
                      {order.status === 'ready' && <span className="text-emerald-400 font-bold bg-emerald-500/10 px-4 py-2.5 rounded-xl border border-emerald-500/20 animate-pulse">⏳ Waiting for Rider...</span>}
                      {order.status === 'assigned' && <span className="text-blue-400 font-bold bg-blue-500/10 px-4 py-2.5 rounded-xl border border-blue-500/20">🛵 Rider Picking Up</span>}
                      {order.status === 'in_delivery' && <span className="text-purple-400 font-bold bg-purple-500/10 px-4 py-2.5 rounded-xl border border-purple-500/20">🚀 Out for Delivery</span>}
                    </div>
                  </div>
                ))}
                {unifiedSafeOrders.filter(o => ['new','accepted','preparing','ready','assigned','in_delivery'].includes(o.status)).length === 0 && (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4 opacity-30">🧾</div>
                    <p className="text-slate-400 text-lg">No active orders right now</p>
                    <p className="text-slate-500 text-sm mt-1">New orders will appear here in real time</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ KANBAN TAB ═══ */}
          {activeTab === 'kanban' && (
            <div className="animate-fade-in">
              <p className="text-slate-400 text-sm mb-5">Drag orders through stages to update their status in real time.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* New */}
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-rose-500/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" />
                      <h3 className="font-black text-rose-400 uppercase tracking-wide text-sm">New Orders</h3>
                    </div>
                    <span className="bg-rose-500/20 text-rose-400 text-xs font-black px-2 py-1 rounded-full">{newOrders.length}</span>
                  </div>
                  {newOrders.length === 0 ? <div className="text-center py-8 text-slate-500 text-sm">No new orders</div> : newOrders.map(o => <KanbanCard key={o.id} order={o} onAction={id => updateOrderStatus(id, 'accepted')} actionLabel="Accept ✓" actionColor="green" />)}
                </div>

                {/* Preparing */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-500/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full" />
                      <h3 className="font-black text-blue-400 uppercase tracking-wide text-sm">Preparing</h3>
                    </div>
                    <span className="bg-blue-500/20 text-blue-400 text-xs font-black px-2 py-1 rounded-full">{preparingOrders.length}</span>
                  </div>
                  {preparingOrders.length === 0 ? <div className="text-center py-8 text-slate-500 text-sm">Nothing preparing</div> : preparingOrders.map(o => <KanbanCard key={o.id} order={o} onAction={o.status === 'accepted' ? id => updateOrderStatus(id, 'preparing') : id => updateOrderStatus(id, 'ready')} actionLabel={o.status === 'accepted' ? '👨‍🍳 Cook' : '✓ Ready'} actionColor={o.status === 'accepted' ? 'blue' : 'amber'} />)}
                </div>

                {/* Ready */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full" />
                      <h3 className="font-black text-emerald-400 uppercase tracking-wide text-sm">Ready for Pickup</h3>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-2 py-1 rounded-full">{readyOrders.length}</span>
                  </div>
                  {readyOrders.length === 0 ? <div className="text-center py-8 text-slate-500 text-sm">Nothing ready yet</div> : readyOrders.map(o => <div key={o.id} className="kanban-card bg-slate-900/80 border border-white/5 rounded-2xl p-4 mb-3 border-emerald-500/20"><p className="text-xs font-mono text-slate-500">#{o.id?.slice(0,8)}</p><p className="font-bold text-white text-sm mt-1 mb-2">{o.item_description || o.items}</p><div className="flex justify-between items-center"><p className="text-emerald-400 font-black">₹{o.amount || o.total}</p><span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 animate-pulse font-bold">⏳ Rider Coming</span></div></div>)}
                </div>
              </div>
            </div>
          )}

          {/* ═══ MENU TAB ═══ */}
          {activeTab === 'menu' && (
            <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black">Menu Manager</h2>
                <button onClick={() => setMenuPreview(!menuPreview)} className={`text-sm font-bold px-4 py-2 rounded-xl transition border ${menuPreview ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'}`}>
                  {menuPreview ? '✏️ Edit Mode' : '👁️ Preview Mode'}
                </button>
              </div>

              {menuPreview ? (
                // Customer Preview Mode
                <div className="max-w-md mx-auto bg-slate-900/50 rounded-3xl border border-white/5 p-4">
                  <p className="text-center text-xs text-amber-400 font-bold uppercase tracking-widest mb-4 border border-amber-500/20 rounded-full py-1.5 bg-amber-500/5">Customer Preview</p>
                  <div className="space-y-3">
                    {menuItems.map(item => (
                      <div key={item.id} className="flex gap-3 items-center p-3 bg-slate-800/60 rounded-xl border border-white/5">
                        {item.image_url && <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />}
                        <div className="flex-1"><p className="font-bold text-white text-sm">{item.name}</p><p className="text-xs text-slate-400">{item.category}</p><p className="text-emerald-400 font-black mt-1">₹{item.price}</p></div>
                        <div className="bg-slate-700 rounded-xl px-4 py-2 text-emerald-400 font-black text-sm border border-emerald-500/20">ADD</div>
                      </div>
                    ))}
                    {menuItems.length === 0 && <p className="text-center text-slate-500 py-8">No items yet. Add some below!</p>}
                  </div>
                </div>
              ) : (
                <div className="grid xl:grid-cols-3 gap-6">
                  {/* Add Item Form */}
                  <div className="xl:col-span-1 bg-slate-800/40 p-6 rounded-3xl border border-white/5 h-fit">
                    <h3 className="text-lg font-black mb-5 text-white border-b border-white/10 pb-4">Add / Edit Item</h3>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Dish Name *</label>
                        <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="e.g. Butter Chicken" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Price (₹) *</label>
                          <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Category *</label>
                          <input type="text" value={itemCat} onChange={e => setItemCat(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="Mains" />
                        </div>
                      </div>
                      {/* Stock Toggle */}
                      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-xl p-3">
                        <span className="text-sm font-bold text-slate-300">In Stock</span>
                        <button onClick={() => setItemInStock(!itemInStock)} className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${itemInStock ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${itemInStock ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Dish Photo</label>
                        <input type="file" id="dish-image-upload" accept="image/*" onChange={handleImageUpload} className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500/10 file:text-amber-400 cursor-pointer" />
                        {itemImg && itemImg.length > 500 && <p className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg font-bold mt-2">📸 Image ready</p>}
                      </div>
                      <button onClick={addMenuItem} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20">
                        Publish to Menu →
                      </button>
                    </div>
                  </div>

                  {/* Menu Items Grid */}
                  <div className="xl:col-span-2">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="text-lg font-black text-white">Live Menu</h3>
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-sm font-black">{menuItems.length} Items</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {menuItems.map((item, idx) => (
                        <div key={idx} className="bg-slate-900/60 p-4 rounded-2xl flex items-center gap-3 border border-white/5 hover:border-amber-500/20 transition group">
                          <img src={item.image_url} alt={item.name} className="w-18 h-18 w-[72px] h-[72px] rounded-xl object-cover shadow-md shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className="font-bold text-white leading-tight truncate pr-2">{item.name}</p>
                              <button onClick={() => setDeleteTarget(item)} className="text-rose-500/40 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition shrink-0">🗑️</button>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                            <div className="flex justify-between items-center mt-2">
                              <p className="font-black text-emerald-400">₹{item.price}</p>
                              <button onClick={() => toggleStockForItem(item)}
                                className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer transition hover:opacity-80 ${item.is_available !== false ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${item.is_available !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {item.is_available !== false ? 'In Stock ↕' : 'Out of Stock ↕'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {menuItems.length === 0 && (
                        <div className="col-span-2 text-center py-16">
                          <div className="text-5xl mb-4 opacity-30">🍽️</div>
                          <p className="text-slate-400 text-lg">Your menu is empty</p>
                          <p className="text-slate-500 text-sm mt-1">Add items using the form on the left</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ PROMOS TAB ═══ */}
          {activeTab === 'promos' && (
            <div className="animate-fade-in max-w-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">Custom Promo Codes</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Create discount codes for your restaurant</p>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-bold">{promoCodes.filter(p => p.active).length} Active</span>
              </div>

              {/* Create New Promo */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-amber-500/10">
                <h3 className="font-black text-white text-base mb-4">Create New Promo</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Code</label>
                    <input type="text" value={newPromoCode} onChange={e => setNewPromoCode(e.target.value.toUpperCase())} placeholder="FLAT20" maxLength={12}
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500 transition font-mono text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Discount %</label>
                    <input type="number" value={newPromoDiscount} onChange={e => setNewPromoDiscount(e.target.value)} placeholder="15"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500 transition text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Min Order ₹</label>
                    <input type="number" value={newPromoMin} onChange={e => setNewPromoMin(e.target.value)} placeholder="150"
                      className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500 transition text-sm" />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!newPromoCode || !newPromoDiscount) return;
                    setPromoCodes(prev => [...prev, { code: newPromoCode, discount: Number(newPromoDiscount), minOrder: Number(newPromoMin) || 0, active: true, uses: 0 }]);
                    setNewPromoCode(''); setNewPromoDiscount(''); setNewPromoMin('');
                    setStatus('✅ Promo code created!');
                    setTimeout(() => setStatus(''), 3000);
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 rounded-xl transition shadow-lg shadow-amber-500/20">
                  + Create Promo Code
                </button>
              </div>

              {/* Active Promos List */}
              <div className="space-y-3">
                {promoCodes.map((promo, i) => (
                  <div key={i} className={`rounded-2xl p-5 border flex items-center justify-between gap-4 transition ${
                    promo.active ? 'bg-slate-800/50 border-amber-500/10 hover:border-amber-500/30' : 'bg-slate-900/40 border-white/5 opacity-60'
                  }`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-white text-lg font-mono tracking-widest">{promo.code}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          promo.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-500'
                        }`}>{promo.active ? 'ACTIVE' : 'INACTIVE'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="text-amber-400 font-bold">{promo.discount}% OFF</span>
                        {promo.minOrder > 0 && <span>Min order: ₹{promo.minOrder}</span>}
                        <span>{promo.uses} uses</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPromoCodes(prev => prev.map((p, idx) => idx === i ? { ...p, active: !p.active } : p))}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${promo.active ? 'bg-amber-500' : 'bg-slate-600'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${promo.active ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                      <button
                        onClick={() => setPromoCodes(prev => prev.filter((_, idx) => idx !== i))}
                        className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center text-sm transition">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {promoCodes.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4 opacity-30">🎟️</div>
                    <p className="text-slate-400">No promo codes yet. Create your first one above!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in max-w-2xl space-y-6">
              {/* Restaurant Profile */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                <h3 className="font-black text-white text-lg mb-5">Restaurant Profile</h3>
                <div className="space-y-4">
                  {[{ label: 'Restaurant Name', v: settingsRestName, s: setSettingsRestName }, { label: 'Description', v: settingsRestDesc, s: setSettingsRestDesc }, { label: 'Address', v: settingsRestAddr, s: setSettingsRestAddr }, { label: 'Call Number', v: settingsRestContact, s: setSettingsRestContact }, { label: 'Support Number', v: settingsRestSupport, s: setSettingsRestSupport }].map((f, i) => (
                    <div key={i}>
                      <label className="text-xs text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">{f.label}</label>
                      <input type="text" value={f.v} onChange={e => f.s(e.target.value)} className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500 transition" />
                    </div>
                  ))}
                  {/* Cuisine Tags */}
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider">Cuisine Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {CUISINE_TAGS.map(tag => (
                        <button key={tag} onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                          className={`text-sm px-3 py-1.5 rounded-xl font-bold transition ${selectedTags.includes(tag) ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={saveRestaurantSettings} className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-3 px-6 rounded-xl transition shadow-lg shadow-amber-500/20">Save Changes →</button>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                <h3 className="font-black text-white text-lg mb-5">Operating Hours</h3>
                <div className="space-y-3">
                  {Object.entries(operatingHours).map(([day, config]) => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-10 text-sm font-black text-slate-300">{day}</div>
                      <button onClick={() => setOperatingHours(p => ({ ...p, [day]: { ...p[day], open: !p[day].open } }))}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors shrink-0 ${config.open ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${config.open ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                      {config.open ? (
                        <>
                          <input type="time" value={config.start} onChange={e => setOperatingHours(p => ({ ...p, [day]: { ...p[day], start: e.target.value } }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-amber-500 transition" />
                          <span className="text-slate-500 text-sm">to</span>
                          <input type="time" value={config.end} onChange={e => setOperatingHours(p => ({ ...p, [day]: { ...p[day], end: e.target.value } }))} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-amber-500 transition" />
                        </>
                      ) : (
                        <span className="text-slate-500 text-sm">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setStatus('✅ Hours saved!')} className="mt-5 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-5 rounded-xl transition text-sm">Save Hours</button>
              </div>

              {/* QR Code Upload */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                <h3 className="font-black text-white text-lg mb-2">Payment QR Code</h3>
                <p className="text-slate-400 text-sm mb-5">Upload your UPI QR code so customers can pay directly to your account.</p>
                <div className="flex items-start gap-5">
                  {partnerQRCode ? (
                    <div className="bg-white p-2 rounded-xl shrink-0">
                      <img src={partnerQRCode} alt="Partner QR" className="w-28 h-28 object-contain" />
                    </div>
                  ) : (
                    <div className="w-28 h-28 bg-slate-900 border-2 border-dashed border-slate-600 rounded-xl flex items-center justify-center text-slate-500 text-3xl shrink-0">
                      📱
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer block">
                      <input type="file" accept="image/*" onChange={handleQRUpload} className="hidden" />
                      <div className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-sm px-5 py-3 rounded-xl transition text-center">
                        📤 {partnerQRCode ? 'Replace QR Code' : 'Upload QR Code'}
                      </div>
                    </label>
                    {partnerQRCode && (
                      <button onClick={() => setPartnerQRCode(null)} className="mt-2 text-xs text-rose-400 hover:text-rose-300 font-bold">✕ Remove QR</button>
                    )}
                    <p className="text-slate-500 text-xs mt-2">PNG/JPG supported. QR will be shown to customers during UPI checkout.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ EARNINGS TAB ═══ */}
          {activeTab === 'earnings' && (
            <div className="animate-fade-in space-y-6">
              {/* Summary Cards */}
              <div className="grid md:grid-cols-3 gap-5">
                <div className="bg-gradient-to-br from-amber-900/30 to-slate-900 border border-amber-500/20 rounded-3xl p-6">
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">This Week</p>
                  <p className="text-4xl font-black text-white">₹{weeklyRevenue.reduce((a,b) => a + b.revenue, 0).toLocaleString()}</p>
                  <p className="text-slate-400 text-xs mt-2">Gross earnings before tax</p>
                </div>
                <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Avg Order Value</p>
                  <p className="text-4xl font-black text-emerald-400">₹{dynamicStats.completedToday ? Math.round(dynamicStats.revenue / dynamicStats.completedToday) : '—'}</p>
                  <p className="text-slate-500 text-xs mt-2">Per completed order</p>
                </div>
                <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Platform Fee</p>
                  <p className="text-4xl font-black text-rose-400">₹{Math.round(weeklyRevenue.reduce((a,b) => a + b.revenue, 0) * 0.15).toLocaleString()}</p>
                  <p className="text-slate-500 text-xs mt-2">15% commission (estimated)</p>
                </div>
              </div>

              {/* Revenue Chart */}
              <div className="bg-slate-800/40 rounded-3xl p-6 border border-white/5">
                <h3 className="font-black text-white text-lg mb-6">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weeklyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.4)" />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} width={55} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', r: 5 }} activeDot={{ r: 7 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && <DeleteModal item={deleteTarget} onConfirm={() => deleteMenuItem(deleteTarget)} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}