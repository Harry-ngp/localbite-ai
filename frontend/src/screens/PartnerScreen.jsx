import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, apiService } from '../services/api';

export default function PartnerScreen({ goBack, globalOrders = [], updateGlobalOrderStatus }) {
   const [email, setEmail] = useState('spice.route@gmail.com');
   const [partnerId, setPartnerId] = useState(null);
   const [restaurant, setRestaurant] = useState(null);
   const [menuItems, setMenuItems] = useState([]);
   const [status, setStatus] = useState('');
   
   const [activeTab, setActiveTab] = useState('overview'); 
   const [isStoreOpen, setIsStoreOpen] = useState(true);
 
   const [orderTab, setOrderTab] = useState('active'); 
   const [orders, setOrders] = useState([]);
   const [dynamicStats, setDynamicStats] = useState({ revenue: 0, activeOrders: 0, completedToday: 0, avgRating: 4.0 });
   
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

   // 🚨 CRITICAL FIX: Merge Live LocalStorage Sync with Database Orders
   const unifiedSafeOrders = [...orders, ...globalOrders.filter(go => !orders.find(o => o.id === go.id))]
     .filter(o => {
       const orderKitchen = (o.kitchen || o.restaurant_name || "").toLowerCase().trim();
       const myKitchen = (restaurant?.name || "").toLowerCase().trim();
       if (orderKitchen && myKitchen && orderKitchen !== myKitchen) return false;
       return true;
     });
 
   const handleImageUpload = (e) => {
     const file = e.target.files[0];
     if (file) {
       const reader = new FileReader();
       reader.onloadend = () => setItemImg(reader.result); 
       reader.readAsDataURL(file);
     }
   };
 
    const updateOrderStatus = async (id, newStatus) => {
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      setStatus(`⏳ Updating order...`);
      
      try {
        let success = false;
        if (newStatus === 'accepted') {
          success = await apiService.acceptOrderAsPartner(id, restaurant.id);
        } else if (newStatus === 'preparing') {
          success = await apiService.markOrderPreparing(id);
        } else if (newStatus === 'ready') {
          success = await apiService.markOrderReady(id);
        }
        
        if (success) {
          setStatus(`✅ Order updated to ${newStatus}`);
          // Also update globalOrders
          if (updateGlobalOrderStatus) {
            updateGlobalOrderStatus(id, newStatus, { restaurant_name: restaurant.name });
          }
        } else {
          setStatus(`❌ Failed to update order status`);
          // Revert local state
          setOrders(prev => prev.map(o => o.id === id ? { ...o, status: o.status } : o));
        }
        
        // Refresh orders from backend
        setTimeout(() => fetchPartnerOrders(restaurant.id), 500);
      } catch (e) { 
        console.log("Error updating order:", e); 
        setStatus(`❌ Error: ${e.message}`);
      }
      
      setTimeout(() => setStatus(''), 3000);
    };
 
   useEffect(() => {
     return () => {
       if (refreshInterval.current) clearInterval(refreshInterval.current);
       if (wsRef.current) wsRef.current.close();
     };
   }, []);
 
   const handleEditItem = (item) => {
     setItemName(item.name); setItemPrice(item.price); setItemCat(item.category); setItemImg(item.image_url);
     setStatus('✏️ Edit mode: Update details and publish.');
   };
 
   const toggleStore = () => {
     setIsStoreOpen(!isStoreOpen);
     setStatus(!isStoreOpen ? '✅ Store is now ONLINE' : '🛑 Store is now OFFLINE');
     setTimeout(() => setStatus(''), 3000);
   };
 
   const handleLogin = async () => {
     setStatus('⏳ Authenticating...');
     try {
       const res = await fetch("http://127.0.0.1:8000/api/v1/partners/login", {
         method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
       });
       if (res.ok) {
         const data = await res.json();
         setPartnerId(data.partner_id);
         if (data.restaurant) {
           setRestaurant(data.restaurant);
           fetchMenu(data.restaurant.id);
           fetchPartnerOrders(data.restaurant.id);
           fetchPartnerAnalytics(data.restaurant.id);
           
           // 🚨 NEW: Connect WebSocket for real-time updates
           wsRef.current = apiService.connectPartnerWS(
             data.partner_id,
             (update) => {
               console.log("📨 Partner received update:", update);
               
               // Listen for all order-related updates
               if (update.type === "order_placed" || update.type === "order_accepted" || 
                   update.type === "gps_update" || update.type === "delivery_complete" ||
                   update.type === "rider_assigned" || update.type === "delivery_started") {
                 
                 // Refresh orders in real-time
                 console.log("🔄 Refreshing orders due to:", update.type);
                 fetchPartnerOrders(data.restaurant.id);
                 fetchPartnerAnalytics(data.restaurant.id);
               }
             },
             (status) => {
               setWsStatus(status);
               if (status === 'connected') {
                 console.log("✅ Partner WebSocket connected - listening for order updates");
               }
             }
           );
           
           // Still keep polling as fallback every 10 seconds
           refreshInterval.current = setInterval(() => {
             fetchPartnerOrders(data.restaurant.id);
             fetchPartnerAnalytics(data.restaurant.id);
           }, 10000);
         }
         setStatus('');
       } else setStatus('❌ Login failed.');
     } catch (e) { setStatus('❌ Server connection failed.'); }
   };
 
   const fetchPartnerOrders = async (restaurantId) => {
     try {
       const res = await fetch(`${API_BASE}/partners/restaurant/${restaurantId}/orders`);
       if (res.ok) {
         const data = await res.json();
         setOrders(data || []);
         console.log(`📋 Partner fetched ${data?.length || 0} orders`);
       }
     } catch (e) { 
       console.log("Failed to fetch partner orders:", e);
       setOrders([]);
     }
   };
 
   const fetchPartnerAnalytics = async (restaurantId) => {
     const analytics = await apiService.getPartnerAnalytics(restaurantId);
     setDynamicStats(prev => ({
       ...prev,
       revenue: analytics.revenue || 0,
       activeOrders: unifiedSafeOrders.filter(o => ['new', 'preparing'].includes(o.status)).length,
       completedToday: unifiedSafeOrders.filter(o => o.status === 'completed').length,
       avgRating: analytics.avgRating || 4.0
     }));
   };
 
   const createRestaurant = async () => {
     setStatus('⏳ Registering Kitchen...');
     try {
       const res = await fetch(`http://127.0.0.1:8000/api/v1/partners/${partnerId}/restaurant`, {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           name: restName, description: restDesc, address: restAddr,
           latitude: 21.1458, longitude: 79.0882, image_url: restImg
         })
       });
       if (res.ok) {
         const data = await res.json();
         setRestaurant(data);
         setStatus('');
       }
     } catch (e) { setStatus('❌ Failed to register kitchen.'); }
   };
 
   const fetchMenu = async (restId) => {
     try {
       const res = await fetch(`http://127.0.0.1:8000/api/v1/partners/restaurant/${restId}/menu`);
       if (res.ok) setMenuItems(await res.json());
     } catch (e) { console.log("Failed to fetch menu"); }
   };
 
   const addMenuItem = async () => {
     if (!itemName || !itemPrice || !itemCat) return setStatus('⚠️ Please fill all required fields');
     setStatus('⏳ Publishing to database...');
     try {
       const res = await fetch(`http://127.0.0.1:8000/api/v1/partners/restaurant/${restaurant.id}/menu`, {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
           name: itemName, description: 'Freshly prepared.', price: parseFloat(itemPrice), category: itemCat, 
           image_url: itemImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'
         })
       });
       if (res.ok) {
         setStatus('✅ Menu synced with server!');
         setItemName(''); setItemPrice(''); setItemCat(''); setItemImg('');
         const fileInput = document.getElementById('dish-image-upload');
         if (fileInput) fileInput.value = '';
         fetchMenu(restaurant.id);
         setTimeout(() => setStatus(''), 3000);
       }
     } catch (e) { setStatus('❌ Failed to add item.'); }
   };
 
   if (!partnerId) {
     return (
       <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center justify-center font-sans">
         <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 text-center">
           <button onClick={goBack} className="text-amber-400 hover:text-amber-300 font-semibold mb-6 block text-left">← Back</button>
           <div className="text-6xl mb-4">👨‍🍳</div>
           <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">Partner Hub</h2>
           <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-amber-500 outline-none mb-6 text-center" placeholder="Restaurant Email" />
           <button onClick={handleLogin} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-amber-500/25 transition transform hover:-translate-y-1 text-lg">Enter Dashboard</button>
           {status && <p className="mt-4 text-amber-300">{status}</p>}
         </div>
       </div>
     );
   }
 
   if (!restaurant) {
     return (
       <div className="min-h-screen bg-[#0f172a] text-white p-6 flex flex-col items-center justify-center font-sans">
         <div className="w-full max-w-2xl bg-slate-900/80 backdrop-blur-md p-10 rounded-3xl border border-amber-500/30 shadow-2xl">
           <h2 className="text-3xl font-bold mb-2 text-amber-400">Register Your Kitchen</h2>
           <p className="text-slate-400 mb-8">Set up your restaurant profile to start receiving orders.</p>
           <div className="flex flex-col gap-5">
             <input type="text" value={restName} onChange={e => setRestName(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition" placeholder="Restaurant Name" />
             <input type="text" value={restDesc} onChange={e => setRestDesc(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition" placeholder="Short Description (e.g. Best Burgers in town)" />
             <input type="text" value={restAddr} onChange={e => setRestAddr(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition" placeholder="Full Address" />
             <input type="text" value={restImg} onChange={e => setRestImg(e.target.value)} className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition" placeholder="Header Image URL" />
             <button onClick={createRestaurant} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-xl mt-4 transition text-lg">Launch Kitchen 🚀</button>
           </div>
         </div>
       </div>
     );
   }
 
   return (
     <div className="min-h-screen bg-[#0f172a] text-white flex font-sans overflow-hidden">
       
       <div className="w-64 bg-slate-900 border-r border-white/5 flex flex-col h-screen p-4 hidden md:flex">
         <div className="mb-8 px-2 mt-4">
           <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 truncate">{restaurant.name}</h2>
           <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Partner Portal</p>
         </div>
         
         <div className="flex flex-col gap-2 flex-grow">
           <button onClick={() => setActiveTab('overview')} className={`p-4 rounded-xl flex items-center gap-3 font-semibold transition ${activeTab === 'overview' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
             📊 Overview
           </button>
            <button onClick={() => setActiveTab('orders')} className={`p-4 rounded-xl flex justify-between items-center font-semibold transition ${activeTab === 'orders' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <div className="flex items-center gap-3">🧾 Live Orders</div>
              {unifiedSafeOrders.filter(o => ['new', 'accepted'].includes(o.status)).length > 0 && (
                <span className="bg-rose-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">{unifiedSafeOrders.filter(o => ['new', 'accepted'].includes(o.status)).length} New</span>
              )}
            </button>
           <button onClick={() => setActiveTab('menu')} className={`p-4 rounded-xl flex items-center gap-3 font-semibold transition ${activeTab === 'menu' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
             🍲 Menu Manager
           </button>
         </div>
 
         <div className="mt-auto border-t border-white/5 pt-4">
            <button onClick={() => { setPartnerId(null); setRestaurant(null); }} className="w-full p-4 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition font-semibold flex items-center gap-2">
              🚪 Log Out
            </button>
         </div>
       </div>
 
       <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">
         
         <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center">
           <div className="md:hidden font-bold text-amber-400 text-xl">{restaurant.name}</div>
           <div className="flex items-center gap-4">
             <h1 className="text-2xl font-bold hidden md:block capitalize">{activeTab}</h1>
             {status && <span className="ml-4 text-sm font-medium text-amber-300 animate-pulse">{status}</span>}
             {/* 🚨 NEW: WebSocket Status Indicator */}
             <div className={`text-xs px-2 py-1 rounded-full font-bold ml-4 ${wsStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400' : wsStatus === 'error' ? 'bg-red-500/20 text-red-400 border border-red-400' : 'bg-slate-600/20 text-slate-400 border border-slate-600'}`}>
               {wsStatus === 'connected' ? '🟢 Live' : wsStatus === 'error' ? '🔴 Reconnecting...' : '🟡 Connecting...'}
             </div>
           </div>
           
           <div className="flex items-center gap-4">
             <span className="text-sm text-slate-400 font-medium mr-2">Status:</span>
             <button 
               onClick={toggleStore} 
               className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isStoreOpen ? 'bg-emerald-500' : 'bg-slate-600'}`}
             >
               <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${isStoreOpen ? 'translate-x-7' : 'translate-x-1'}`} />
             </button>
             <span className={`font-bold ${isStoreOpen ? 'text-emerald-400' : 'text-slate-500'}`}>{isStoreOpen ? 'OPEN' : 'CLOSED'}</span>
           </div>
         </div>
 
         <div className="p-8">
           
           {activeTab === 'overview' && (
             <div className="animate-fade-in">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                 <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                   <p className="text-slate-400 font-medium mb-2">Today's Revenue</p>
                   <p className="text-4xl font-black text-white">₹{dynamicStats.revenue}</p>
                 </div>
                 <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                   <p className="text-slate-400 font-medium mb-2">Active Orders</p>
                   <p className="text-4xl font-black text-white">{dynamicStats.activeOrders}</p>
                 </div>
                 <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                   <p className="text-slate-400 font-medium mb-2">Completed Today</p>
                   <p className="text-4xl font-black text-white">{dynamicStats.completedToday}</p>
                 </div>
                 <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                   <p className="text-slate-400 font-medium mb-2">Restaurant Rating</p>
                   <p className="text-4xl font-black text-yellow-400">⭐ {dynamicStats.avgRating}</p>
                 </div>
               </div>
             </div>
           )}
 
           {activeTab === 'orders' && (
             <div className="animate-fade-in">
               <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
                  <button onClick={() => setOrderTab('active')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'active' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>
                    Active ({unifiedSafeOrders.filter(o => ['new', 'accepted', 'preparing', 'ready', 'assigned', 'in_delivery'].includes(o.status)).length})
                  </button>
                  <button onClick={() => setOrderTab('completed')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'completed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>
                    Completed ({unifiedSafeOrders.filter(o => o.status === 'completed' || o.status === 'delivered').length})
                  </button>
                 <button onClick={() => setOrderTab('cancelled')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'cancelled' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>
                   Cancelled
                 </button>
               </div>
 
               <div className="grid gap-4">
                  {unifiedSafeOrders.filter(o => {
                    if (orderTab === 'active') return ['new', 'accepted', 'preparing', 'ready', 'assigned', 'in_delivery'].includes(o.status);
                    if (orderTab === 'completed') return o.status === 'completed' || o.status === 'delivered';
                    return o.status === 'cancelled';
                  }).map((order) => (
                   <div key={order.id} className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-amber-500/30 transition">
                     <div>
                       <div className="flex items-center gap-3 mb-2">
                         <h3 className="text-xl font-black text-white">{order.id}</h3>
                         <span className="text-slate-400 text-sm">• {order.time || 'Recently'}</span>
                       </div>
                       <p className="text-amber-400 font-medium mb-1">{order.item_description || order.items}</p>
                       <p className="text-slate-300 font-bold">Total: {order.amount ? `₹${order.amount}` : order.total}</p>
                     </div>
                     
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {order.status === 'new' && <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-emerald-500/20">Accept Order</button>}
                        {order.status === 'accepted' && <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-500/20">Start Preparing 👨‍🍳</button>}
                        {order.status === 'preparing' && <button onClick={() => updateOrderStatus(order.id, 'ready')} className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-amber-500/20">Mark Ready ✓</button>}
                        {order.status === 'ready' && (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20 animate-pulse">⏳ Waiting for Rider...</span>
                        )}
                        {order.status === 'assigned' && <span className="text-blue-400 font-bold bg-blue-500/10 px-4 py-3 rounded-xl border border-blue-500/20">🛵 Rider Picking Up</span>}
                        {order.status === 'in_delivery' && <span className="text-purple-400 font-bold bg-purple-500/10 px-4 py-3 rounded-xl border border-purple-500/20">🚀 Out for Delivery</span>}
                        {(order.status === 'completed' || order.status === 'delivered') && <span className="text-slate-500 font-bold px-4 py-3">✅ Delivered</span>}
                      </div>
                   </div>
                 ))}
                 
                  {unifiedSafeOrders.filter(o => {
                    if (orderTab === 'active') return ['new', 'accepted', 'preparing', 'ready', 'assigned', 'in_delivery'].includes(o.status);
                    if (orderTab === 'completed') return o.status === 'completed' || o.status === 'delivered';
                    return o.status === 'cancelled';
                  }).length === 0 && (
                   <p className="text-slate-500 py-10 text-center">No orders in this category.</p>
                 )}
               </div>
             </div>
           )}
 
           {activeTab === 'menu' && (
             <div className="animate-fade-in grid xl:grid-cols-3 gap-8">
               
               <div className="xl:col-span-1 bg-slate-800/50 p-6 rounded-3xl border border-white/5 h-fit">
                 <h3 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Add / Edit Item</h3>
                 <div className="flex flex-col gap-4">
                   <div>
                     <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Dish Name*</label>
                     <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="e.g. Butter Chicken" />
                   </div>
                   <div className="flex gap-4">
                     <div className="w-1/2">
                       <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Price (₹)*</label>
                       <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="0.00" />
                     </div>
                     <div className="w-1/2">
                       <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Category*</label>
                       <input type="text" value={itemCat} onChange={e => setItemCat(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-amber-500 transition text-white" placeholder="e.g. Mains" />
                     </div>
                   </div>
                   
                   <div>
                     <label className="text-xs text-slate-400 font-bold mb-1 block uppercase tracking-wider">Dish Photo</label>
                     <input 
                       type="file" 
                       id="dish-image-upload"
                       accept="image/*" 
                       onChange={handleImageUpload} 
                       className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl outline-none transition text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer" 
                     />
                   </div>
                   
                   {itemImg && itemImg.length > 500 && (
                     <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg font-bold">
                       📸 Image selected and ready for upload
                     </div>
                   )}
                   
                   <button onClick={addMenuItem} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-4 rounded-xl transition mt-2 shadow-lg shadow-amber-500/20">
                     Publish to Menu
                   </button>
                 </div>
               </div>
 
               <div className="xl:col-span-2 bg-slate-800/30 p-6 rounded-3xl border border-white/5">
                 <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                   <h3 className="text-xl font-bold text-white">Live Menu</h3>
                   <span className="bg-slate-800 text-amber-400 px-3 py-1 rounded-full text-sm font-bold border border-amber-500/20">{menuItems.length} Items</span>
                 </div>
                 
                 <div className="grid md:grid-cols-2 gap-4">
                   {menuItems.map((item, idx) => (
                     <div key={idx} className="bg-slate-900/60 p-4 rounded-2xl flex items-center gap-4 border border-white/5 hover:border-amber-500/20 transition group">
                       <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover shadow-md" />
                       <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <p className="font-bold text-white text-lg leading-tight">{item.name}</p>
                           <button onClick={() => handleEditItem(item)} className="text-amber-500/50 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition text-sm font-bold bg-amber-500/10 px-2 py-1 rounded">Edit</button>
                         </div>
                         <p className="text-sm text-slate-400 mt-1">{item.category}</p>
                         <div className="flex justify-between items-center mt-2">
                           <p className="font-black text-emerald-400">₹{item.price}</p>
                           <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1">
                             <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> In Stock
                           </span>
                         </div>
                       </div>
                     </div>
                   ))}
                   {menuItems.length === 0 && (
                     <div className="col-span-2 text-center py-12">
                       <div className="text-5xl mb-4 opacity-50">🍽️</div>
                       <p className="text-slate-400 text-lg">Your menu is empty.</p>
                       <p className="text-slate-500 text-sm mt-1">Add items using the form to start selling.</p>
                     </div>
                   )}
                 </div>
               </div>
             </div>
           )}
           
         </div>
       </div>
     </div>
   );
}