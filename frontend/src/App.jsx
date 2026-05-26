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
// 2. THE RIDER COMPONENT
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
  
  const wsRef = useRef(null)
  const driveInterval = useRef(null) 

  const handleLogin = async () => {
    setStatus('⏳ Authenticating...')
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/riders/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email }) })
      if (response.ok) {
        const data = await response.json()
        setRiderId(data.rider_id)
        setIsLoggedIn(true)
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
      }
    };
    return () => { ws.close(); wsRef.current = null; if (driveInterval.current) clearInterval(driveInterval.current); }
  }, [isLoggedIn, riderId]);

  const startDriving = () => {
    setIsDriving(true);
    setStatus('🛵 IN TRANSIT: Delivering order...');
    driveInterval.current = setInterval(() => {
      setCurrentLocation((prevLoc) => {
        const newLat = prevLoc[0] + 0.0005; const newLng = prevLoc[1] + 0.0005;
        setPathHistory(prevPath => [...prevPath, [newLat, newLng]]);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "gps_update", lat: newLat, lng: newLng }));
        }
        return [newLat, newLng];
      });
    }, 2000);
  }

  const completeDelivery = () => {
    clearInterval(driveInterval.current);
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
// 3. MAIN APP ROUTER
// ==========================================
function App() {
  const [currentRoute, setCurrentRoute] = useState('/')
  if (currentRoute === '/customer') return <CustomerScreen goBack={() => setCurrentRoute('/')} />
  if (currentRoute === '/rider') return <RiderScreen goBack={() => setCurrentRoute('/')} />

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-rose-500/10 blur-[100px] rounded-full"></div>
      </div>
      
      <div className="z-10 text-center mb-12">
        <h1 className="text-6xl md:text-7xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 drop-shadow-2xl">
          LocalBite <span className="text-white">AI</span>
        </h1>
        <p className="text-slate-400 text-xl font-medium tracking-wide">Intelligent routing. Instant delivery.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl z-10">
        <button onClick={() => setCurrentRoute('/customer')} className="flex-1 group bg-white/5 hover:bg-white/10 backdrop-blur-md border border-emerald-500/30 p-8 rounded-3xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <div className="text-5xl mb-4 transform group-hover:-translate-y-2 transition duration-300">🍔</div>
          <h3 className="text-2xl font-bold text-emerald-400 mb-2">Customer App</h3>
          <p className="text-slate-400 text-sm">Order food and track delivery in real-time.</p>
        </button>
        
        <button onClick={() => setCurrentRoute('/rider')} className="flex-1 group bg-white/5 hover:bg-white/10 backdrop-blur-md border border-rose-500/30 p-8 rounded-3xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(244,63,94,0.2)]">
          <div className="text-5xl mb-4 transform group-hover:-translate-y-2 transition duration-300">🛵</div>
          <h3 className="text-2xl font-bold text-rose-400 mb-2">Rider Radar</h3>
          <p className="text-slate-400 text-sm">Receive orders and navigate via GPS.</p>
        </button>
      </div>
    </div>
  )
}

export default App