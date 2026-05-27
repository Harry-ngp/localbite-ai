import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// --- CUSTOM MOTORCYCLE ICON ---
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1986/1986937.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
})

// ==========================================
// 1. THE CUSTOMER SCREEN
// ==========================================
function CustomerScreen({ goBack }) {
  const [name, setName] = useState('Harikesh')
  const [item, setItem] = useState('2x Butter Naan & Paneer')
  const [amount, setAmount] = useState(350)
  const [address, setAddress] = useState('Behind Hanuman Temple, near old Banyan Tree, Station Road, Nagpur')
  const [status, setStatus] = useState('')

  const [isTracking, setIsTracking] = useState(false)
  const [riderLocation, setRiderLocation] = useState(null)
  const [pathHistory, setPathHistory] = useState([])
  
  const [isDelivered, setIsDelivered] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [feedbackSaved, setFeedbackSaved] = useState(false)

  const placeOrder = async () => {
    setStatus('⏳ Processing order...')
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: name, delivery_address: address, item_description: item, amount: parseFloat(amount), volume_units: 20 })
      })
      if (response.ok) {
        setStatus('✅ Order Placed! Waiting for a rider to accept...')
        startTracking()
      } else setStatus('❌ Error placing order.')
    } catch (error) { setStatus('❌ Could not connect to backend server.') }
  }

  const startTracking = () => {
    setIsTracking(true)
    const trackingId = "demo_order_123" 
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/customer/${trackingId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "gps_update") {
        setStatus('🛵 Rider Harsh is on the way!')
        setRiderLocation([data.lat, data.lng])
        // The customer map will draw the route organically point-by-point!
        setPathHistory(prev => [...prev, [data.lat, data.lng]])
      }
      if (data.type === "delivery_complete") {
        setStatus('🎉 FOOD DELIVERED! Enjoy your meal 🍔')
        setIsDelivered(true)
        new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3').play().catch(() => {});
      }
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 transition-all">
        <button onClick={goBack} className="mb-8 text-emerald-400 hover:text-emerald-300 font-semibold tracking-wide transition flex items-center gap-2">
          <span>←</span> Back to Home
        </button>
        
        <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">
          Order Food
        </h2>
        
        {!isTracking ? (
          <div className="flex flex-col gap-5">
            <div className="space-y-4">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition placeholder-slate-500" placeholder="Your Name" />
              <input type="text" value={item} onChange={e => setItem(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition placeholder-slate-500" placeholder="What are you craving?" />
              <textarea value={address} onChange={e => setAddress(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition placeholder-slate-500 h-32 resize-none" placeholder="Delivery Address" />
            </div>
            
            <button onClick={placeOrder} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/25 transform transition hover:-translate-y-1 mt-4 text-lg">
              Confirm & Pay ₹{amount}
            </button>
            {status && <p className="text-center mt-4 font-medium text-emerald-300 animate-pulse">{status}</p>}
          </div>
        ) : !isDelivered ? (
          <div className="mt-2">
            <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50 mb-6 flex items-center justify-center">
               <p className="font-mono text-lg text-emerald-400 animate-pulse m-0">{status}</p>
            </div>
            
            {riderLocation ? (
              <div className="w-full h-[400px] bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
                <MapContainer center={riderLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={pathHistory} color="#10b981" weight={5} opacity={0.8} />
                  <Marker position={riderLocation} icon={bikeIcon}>
                    <Popup>Your food is here! 🛵</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="w-full h-64 bg-slate-900/30 rounded-3xl flex items-center justify-center border-2 border-slate-700/50 border-dashed">
                <p className="text-slate-400 font-medium">Acquiring Rider GPS Signal...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 text-center bg-slate-900/40 p-10 rounded-3xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-500">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
               <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-3">Delivery Complete!</h3>
            <p className="text-slate-300 mb-10 text-lg">How was your experience with Harsh?</p>
            
            {!feedbackSaved ? (
              <>
                <div className="flex justify-center gap-3 mb-10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} onClick={() => setRating(star)} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)}
                      className="text-5xl transition-transform hover:scale-125 focus:outline-none drop-shadow-lg"
                    >
                      <span className={(hoveredStar || rating) >= star ? "text-yellow-400" : "text-slate-700"}>★</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setFeedbackSaved(true)} disabled={rating === 0} className={`w-full py-4 rounded-2xl font-bold text-lg transition ${rating > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
                  Submit Feedback
                </button>
              </>
            ) : (
              <div className="py-6 animate-fade-in">
                <p className="text-2xl font-bold text-emerald-400">Thank you! ⭐</p>
                <p className="text-slate-400 mt-2">Your feedback helps keep our community great.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 2. THE RIDER COMPONENT (OSRM UPGRADE)
// ==========================================
function RiderScreen({ goBack }) {
  const [email, setEmail] = useState('harsh01@gmail.com')
  const [riderId, setRiderId] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [status, setStatus] = useState('🟡 Waiting to connect...')
  const [offer, setOffer] = useState(null)
  const [isDriving, setIsDriving] = useState(false)
  const [currentLocation, setCurrentLocation] = useState([21.1458, 79.0882])
  const [pathHistory, setPathHistory] = useState([[21.1458, 79.0882]])
  
  // 🚨 NEW: Store the full OSRM street array
  const [fullRoute, setFullRoute] = useState([]) 
  
  const [earnings, setEarnings] = useState(0)
  const [trips, setTrips] = useState(0)
  
  const wsRef = useRef(null)
  const driveInterval = useRef(null) 

  const fetchEarnings = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/riders/${id}/earnings`);
      if (response.ok) {
        const data = await response.json();
        setEarnings(data.total_earnings);
        setTrips(data.completed_trips);
      }
    } catch (error) {
      console.log("Could not fetch earnings");
    }
  }

  const handleLogin = async () => {
    setStatus('⏳ Authenticating...')
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/riders/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) })
      if (response.ok) {
        const data = await response.json()
        setRiderId(data.rider_id)
        setIsLoggedIn(true)
        fetchEarnings(data.rider_id)
      } else setStatus('❌ Rider not found.')
    } catch (error) { setStatus('❌ Server connection failed.') }
  }

  useEffect(() => {
    if (!isLoggedIn || !riderId) return;
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/rider/${riderId}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('🟢 ONLINE: Scanning for nearby orders...');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_order_offer") {
        setOffer(data);
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => console.log("Sound blocked"));
        
        // 🚨 NEW: Fetch the real street route from OSRM!
        const start = [21.1458, 79.0882];
        const dest = [21.1550, 79.0950]; // Example nearby destination in Nagpur
        
        // OSRM requires "longitude,latitude"
        fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`)
          .then(res => res.json())
          .then(routeData => {
            if (routeData.routes && routeData.routes.length > 0) {
              // Convert OSRM [lng, lat] back to Leaflet [lat, lng]
              const coords = routeData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              setFullRoute(coords);
              setPathHistory(coords); // Instantly preview the entire road path on the Rider map
            }
          })
          .catch(() => console.log("Map API Failed"));
      }
    };
    return () => { ws.close(); wsRef.current = null; if (driveInterval.current) clearInterval(driveInterval.current); }
  }, [isLoggedIn, riderId]);

  // 🚨 UPGRADED: Navigating the OSRM street array
  const startDriving = async () => {
    setStatus('⏳ Securing order in database...');

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.order_id}/assign?rider_id=${riderId}`, { 
        method: "PUT" 
      });
      if (!response.ok) {
        const errorData = await response.json();
        setStatus(`❌ Assignment Failed: ${errorData.detail}`);
        return; 
      }
    } catch (error) {
      setStatus('❌ Network Error. Could not reach server.');
      return; 
    }

    setIsDriving(true);
    setStatus('🛵 IN TRANSIT: Navigating traffic...');

    let currentIndex = 0;
    
    // We run the interval faster (every 500ms) for smooth animation along the streets
    driveInterval.current = setInterval(() => {
      // If we reach the end of the OSRM route, stop automatically!
      if (currentIndex >= fullRoute.length) {
        clearInterval(driveInterval.current);
        setStatus('📍 Arrived at destination! Please mark as delivered.');
        return;
      }
      
      const nextPoint = fullRoute[currentIndex];
      setCurrentLocation(nextPoint);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "gps_update", lat: nextPoint[0], lng: nextPoint[1] }));
      }
      
      currentIndex++;
    }, 500);
  }

  const completeDelivery = async () => {
    clearInterval(driveInterval.current);
    setStatus('⏳ Finalizing delivery with server...');
    
    try {
      await fetch(`http://127.0.0.1:8000/api/v1/orders/${offer.order_id}/complete`, { method: "PUT" });
      await fetchEarnings(riderId);
    } catch (error) {
      console.log("Database update failed");
    }

    setStatus('✅ Delivered! Scanning for next order...');
    setIsDriving(false); setOffer(null); setPathHistory([[21.1458, 79.0882]]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "delivery_complete" }));
  }

  const openGoogleMaps = () => {
    const destination = encodeURIComponent(offer?.delivery_address || "");
    window.open(`http://googleusercontent.com/maps.google.com/maps?q=${destination}`, '_blank');
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/10 text-center">
          <h2 className="text-4xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Rider Portal</h2>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-2xl text-white focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition text-center text-lg mb-6" placeholder="Rider Email" />
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-500/25 transform transition hover:-translate-y-1 text-lg">
            Go Online 🛵
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-[#0f172a] to-black text-white p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 transition-all">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">Rider Dashboard</h2>
          <button onClick={() => { setIsLoggedIn(false); setRiderId(''); }} className="text-slate-400 hover:text-white font-semibold transition px-4 py-2 bg-slate-800 rounded-xl">Log Out</button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900/60 backdrop-blur-md border border-emerald-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.1)] transition transform hover:scale-105">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Today's Earnings</p>
            <p className="text-4xl font-black text-emerald-400">₹{earnings}</p>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/30 rounded-3xl p-6 shadow-[0_0_20px_rgba(244,63,94,0.1)] transition transform hover:scale-105">
            <p className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-wider">Completed Trips</p>
            <p className="text-4xl font-black text-rose-400">{trips}</p>
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

        {(offer || isDriving) && (
          <div className="bg-slate-900/60 backdrop-blur-md border border-rose-500/30 rounded-3xl p-8 shadow-[0_0_30px_rgba(244,63,94,0.15)] relative z-10 transition-all">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>
               <h3 className="text-2xl font-bold text-white">
                 {isDriving ? '📍 Active Delivery' : '🚨 New Order Offer'}
               </h3>
            </div>
            
            <div className="bg-slate-800/50 rounded-2xl p-4 mb-8">
               <p className="text-slate-400 text-sm mb-1">Dropoff Location</p>
               <p className="text-lg font-medium text-white">{offer?.delivery_address}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {!isDriving ? (
                <button onClick={startDriving} className="flex-1 bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-rose-500/25 transition transform hover:-translate-y-1">
                  Accept & Drive
                </button>
              ) : (
                <button onClick={completeDelivery} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/25 transition transform hover:-translate-y-1">
                  ✅ Complete Delivery
                </button>
              )}
              
              <button onClick={openGoogleMaps} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-2xl border border-slate-600 transition flex justify-center items-center gap-2">
                🧭 Open Maps
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 3. THE PARTNER DASHBOARD (STUB)
// ==========================================
// ==========================================
// 3. THE PARTNER DASHBOARD (FULLY WIRED UI + FILE UPLOAD)
// ==========================================
function PartnerScreen({ goBack }) {
  const [email, setEmail] = useState('spice.route@gmail.com');
  const [partnerId, setPartnerId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [status, setStatus] = useState('');
  
  // Dashboard Navigation States
  const [activeTab, setActiveTab] = useState('overview'); 
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  // --- INTERACTIVE ORDER STATE ---
  const [orderTab, setOrderTab] = useState('active'); 
  const [orders, setOrders] = useState([
    { id: '#ORD-8821', time: '2 mins ago', items: '2x Butter Naan, 1x Paneer Tikka', total: '₹450', status: 'new' },
    { id: '#ORD-8820', time: '15 mins ago', items: '1x Chicken Biryani, 1x Coke', total: '₹320', status: 'preparing' },
    { id: '#ORD-8819', time: '28 mins ago', items: '2x Garlic Bread', total: '₹180', status: 'ready' },
    { id: '#ORD-8700', time: '2 hours ago', items: '1x Veg Thali', total: '₹200', status: 'completed' }
  ]);

  // Form States
  const [restName, setRestName] = useState('The Spice Route');
  const [restDesc, setRestDesc] = useState('Authentic North Indian cuisine.');
  const [restAddr, setRestAddr] = useState('123 Food Street, Nagpur');
  const [restImg, setRestImg] = useState('https://images.unsplash.com/photo-1589302168068-964664d93cb0?w=500&q=80');

  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCat, setItemCat] = useState('');
  const [itemImg, setItemImg] = useState('');

  // --- 🚨 NEW: LOCAL IMAGE UPLOAD HANDLER ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      // Converts the local file into a Base64 string that can be saved and displayed instantly
      reader.onloadend = () => setItemImg(reader.result); 
      reader.readAsDataURL(file);
    }
  };

  // --- BUTTON FUNCTIONS ---
  const updateOrderStatus = (id, newStatus) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    setStatus(`✅ Order ${id} updated to ${newStatus}`);
    setTimeout(() => setStatus(''), 3000);
  };

  const handleEditItem = (item) => {
    setItemName(item.name);
    setItemPrice(item.price);
    setItemCat(item.category);
    setItemImg(item.image_url);
    setStatus('✏️ Edit mode: Update details and publish.');
  };

  const toggleStore = () => {
    setIsStoreOpen(!isStoreOpen);
    setStatus(!isStoreOpen ? '✅ Store is now ONLINE' : '🛑 Store is now OFFLINE');
    setTimeout(() => setStatus(''), 3000);
  };

  // Filter orders based on the selected tab
  const displayedOrders = orders.filter(o => {
    if (orderTab === 'active') return ['new', 'preparing', 'ready'].includes(o.status);
    return o.status === orderTab;
  });

  // --- BACKEND API CALLS ---
  const handleLogin = async () => {
    setStatus('⏳ Authenticating...');
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/partners/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        const data = await res.json();
        setPartnerId(data.partner_id);
        if (data.restaurant) {
          setRestaurant(data.restaurant);
          fetchMenu(data.restaurant.id);
        }
        setStatus('');
      } else setStatus('❌ Login failed.');
    } catch (e) { setStatus('❌ Server connection failed.'); }
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
          name: itemName, description: 'Freshly prepared.',
          price: parseFloat(itemPrice), category: itemCat, 
          image_url: itemImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'
        })
      });
      if (res.ok) {
        setStatus('✅ Menu synced with server!');
        setItemName(''); setItemPrice(''); setItemCat(''); setItemImg('');
        // Clear the file input visually
        const fileInput = document.getElementById('dish-image-upload');
        if (fileInput) fileInput.value = '';
        fetchMenu(restaurant.id);
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (e) { setStatus('❌ Failed to add item.'); }
  };

  // ==========================================
  // RENDER VIEWS
  // ==========================================
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
      
      {/* 1. SIDEBAR NAVIGATION */}
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
            {orders.filter(o => o.status === 'new').length > 0 && (
              <span className="bg-rose-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">{orders.filter(o => o.status === 'new').length} New</span>
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

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        
        {/* TOP NAVBAR */}
        <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center">
          <div className="md:hidden font-bold text-amber-400 text-xl">{restaurant.name}</div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold hidden md:block capitalize">{activeTab}</h1>
            {status && <span className="ml-4 text-sm font-medium text-amber-300 animate-pulse">{status}</span>}
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
          
          {/* --- TAB: OVERVIEW --- */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                  <p className="text-slate-400 font-medium mb-2">Today's Revenue</p>
                  <p className="text-4xl font-black text-white">₹4,250</p>
                  <p className="text-emerald-400 text-sm mt-2 font-medium">↑ 12% from yesterday</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                  <p className="text-slate-400 font-medium mb-2">Active Orders</p>
                  <p className="text-4xl font-black text-white">{orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status)).length}</p>
                  <p className="text-amber-400 text-sm mt-2 font-medium">Live right now</p>
                </div>
                <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-lg">
                  <p className="text-slate-400 font-medium mb-2">Menu Items</p>
                  <p className="text-4xl font-black text-white">{menuItems.length}</p>
                  <p className="text-slate-400 text-sm mt-2 font-medium">All items in stock</p>
                </div>
              </div>

              <div className="bg-slate-800/30 p-8 rounded-3xl border border-white/5">
                <h3 className="text-xl font-bold mb-6">Recent Activity</h3>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">✓</div>
                        <div>
                          <p className="font-bold text-white">Order #ORD-881{9-i} delivered</p>
                          <p className="text-sm text-slate-400">Rider successfully dropped off.</p>
                        </div>
                      </div>
                      <span className="text-slate-500 text-sm">45 mins ago</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: ORDERS --- */}
          {activeTab === 'orders' && (
            <div className="animate-fade-in">
              <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
                <button onClick={() => setOrderTab('active')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'active' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>Active ({orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status)).length})</button>
                <button onClick={() => setOrderTab('completed')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'completed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>Completed</button>
                <button onClick={() => setOrderTab('cancelled')} className={`px-4 py-2 rounded-lg font-bold transition ${orderTab === 'cancelled' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}>Cancelled</button>
              </div>

              <div className="grid gap-4">
                {displayedOrders.length === 0 && <p className="text-slate-500 py-10 text-center">No orders in this category.</p>}
                
                {displayedOrders.map((order) => (
                  <div key={order.id} className="bg-slate-800/50 p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-amber-500/30 transition">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-white">{order.id}</h3>
                        <span className="text-slate-400 text-sm">• {order.time}</span>
                      </div>
                      <p className="text-amber-400 font-medium mb-1">{order.items}</p>
                      <p className="text-slate-300 font-bold">Total: {order.total}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      {order.status === 'new' && <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-emerald-500/20">Accept Order</button>}
                      {order.status === 'preparing' && <button onClick={() => updateOrderStatus(order.id, 'ready')} className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-amber-500/20">Mark Ready</button>}
                      {order.status === 'ready' && (
                        <div className="flex gap-2">
                           <span className="text-emerald-400 font-bold bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20">Waiting for Rider...</span>
                           <button onClick={() => updateOrderStatus(order.id, 'completed')} className="bg-slate-700 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition">✓ Done</button>
                        </div>
                      )}
                      {order.status === 'completed' && <span className="text-slate-500 font-bold px-4 py-3">Delivered</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- TAB: MENU MANAGER --- */}
          {activeTab === 'menu' && (
            <div className="animate-fade-in grid xl:grid-cols-3 gap-8">
              
              {/* Form Side */}
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
                  
                  {/* 🚨 THE NEW FILE UPLOAD INPUT */}
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

              {/* List Side */}
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
// ==========================================
// 4. MAIN APP ROUTER (THE GRAND LANDING PAGE)
// ==========================================
function App() {
  const [currentRoute, setCurrentRoute] = useState('/')
  
  if (currentRoute === '/customer') return <CustomerScreen goBack={() => setCurrentRoute('/')} />
  if (currentRoute === '/rider') return <RiderScreen goBack={() => setCurrentRoute('/')} />
  if (currentRoute === '/partner') return <PartnerScreen goBack={() => setCurrentRoute('/')} />

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full"></div>
         <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full"></div>
      </div>
      
      <div className="z-10 text-center mb-16 mt-8">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-sm font-medium text-slate-300 tracking-widest uppercase">
          Marketplace Platform
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 drop-shadow-2xl">
          LocalBite <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">AI</span>
        </h1>
        <p className="text-slate-400 text-xl md:text-2xl font-medium tracking-wide max-w-2xl mx-auto leading-relaxed">
          The intelligent neighborhood engine connecting hungry locals, fast riders, and great kitchens.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl z-10">
        {/* Pillar 1: Customer */}
        <button onClick={() => setCurrentRoute('/customer')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-emerald-500/20 hover:border-emerald-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition duration-500 origin-left">🍔</div>
            <h3 className="text-3xl font-bold text-white mb-3">Order Food</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Discover nearby restaurants and track your delivery in real-time on the map.</p>
          </div>
          <div className="mt-8 flex items-center text-emerald-400 font-semibold group-hover:gap-4 gap-2 transition-all">
            Enter App <span>→</span>
          </div>
        </button>
        
        {/* Pillar 2: Rider */}
        <button onClick={() => setCurrentRoute('/rider')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-rose-500/20 hover:border-rose-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:-translate-x-2 transition duration-500 origin-left">🛵</div>
            <h3 className="text-3xl font-bold text-white mb-3">Drive & Earn</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Accept nearby orders, navigate with AI routing, and track your daily wallet.</p>
          </div>
          <div className="mt-8 flex items-center text-rose-400 font-semibold group-hover:gap-4 gap-2 transition-all">
            Go Online <span>→</span>
          </div>
        </button>

        {/* Pillar 3: Partner */}
        <button onClick={() => setCurrentRoute('/partner')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:-rotate-6 transition duration-500 origin-left">👨‍🍳</div>
            <h3 className="text-3xl font-bold text-white mb-3">Partner Kitchen</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Manage your digital menu, accept incoming orders, and grow your local reach.</p>
          </div>
          <div className="mt-8 flex items-center text-amber-400 font-semibold group-hover:gap-4 gap-2 transition-all">
            Manage Hub <span>→</span>
          </div>
        </button>
      </div>
    </div>
  )
}

export default App