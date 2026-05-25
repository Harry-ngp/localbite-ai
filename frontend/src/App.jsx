import { useState, useEffect } from 'react'
// ==========================================
// 1. THE CUSTOMER COMPONENT
// ==========================================
function CustomerScreen({ goBack }) {
  // Hooks are perfectly legal here because they are at the top of the component!
  const [name, setName] = useState('Harikesh')
  const [item, setItem] = useState('2x Butter Naan & Paneer')
  const [amount, setAmount] = useState(350)
  const [address, setAddress] = useState('Behind Hanuman Temple, near old Banyan Tree, Station Road, Nagpur')
  const [status, setStatus] = useState('')

  const placeOrder = async () => {
    setStatus('⏳ Processing order...')
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/orders/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name,
          delivery_address: address,
          item_description: item,
          amount: parseFloat(amount),
          volume_units: 20
        })
      })

      if (response.ok) {
        setStatus('✅ Order Placed! AI is routing it to nearby riders...')
      } else {
        setStatus('❌ Error placing order.')
      }
    } catch (error) {
      setStatus('❌ Could not connect to backend server.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 flex flex-col items-center">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
        <button onClick={goBack} className="mb-6 text-blue-400 hover:text-blue-300 font-bold transition">
          ← Back to Home
        </button>
        <h2 className="text-3xl font-bold mb-2 text-green-400">🍔 Order Food</h2>
        <p className="text-gray-400 mb-6">Type your address messily. Our AI will figure it out.</p>

        <div className="flex flex-col gap-4">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500" />
          <input type="text" value={item} onChange={e => setItem(e.target.value)} className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500" />
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500" />
          <textarea value={address} onChange={e => setAddress(e.target.value)} className="p-3 bg-gray-700 border border-gray-600 rounded-lg text-white h-24 focus:outline-none focus:border-green-500" />
          
          <button onClick={placeOrder} className="bg-green-600 hover:bg-green-500 p-4 rounded-lg font-bold text-lg mt-2 transition transform hover:scale-105">
            Place Order
          </button>

          {status && <p className="text-center mt-4 font-semibold text-lg text-yellow-300">{status}</p>}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 2. THE RIDER COMPONENT (Real Handshake!)
// ==========================================
function RiderScreen({ goBack }) {
  // We now ask for an email, not a hardcoded ID
  const [email, setEmail] = useState('test@rider.com') // Put your test email here!
  const [riderId, setRiderId] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  
  const [status, setStatus] = useState('🟡 Waiting to connect...')
  const [offer, setOffer] = useState(null)
  const [loginError, setLoginError] = useState('')

  // --- THE LOGIN FUNCTION ---
  const handleLogin = async () => {
    setStatus('⏳ Authenticating...')
    setLoginError('')
    
    try {
      // 1. Ask the backend for the UUID associated with this email
      const response = await fetch("http://127.0.0.1:8000/api/v1/riders/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      })

      if (response.ok) {
        const data = await response.json()
        // 2. Success! Save the UUID and flip the login switch
        setRiderId(data.rider_id)
        setIsLoggedIn(true)
      } else {
        setLoginError('❌ Rider not found. Check the email.')
        setStatus('🟡 Waiting to connect...')
      }
    } catch (error) {
      setLoginError('❌ Could not connect to server.')
      setStatus('🟡 Waiting to connect...')
    }
  }

  // --- THE WEBSOCKET CONNECTION ---
  useEffect(() => {
    // 🚨 Only connect AFTER we successfully logged in and got the UUID!
    if (!isLoggedIn || !riderId) return;

    // Connect using the dynamic UUID we just fetched
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/rider/${riderId}`);

    ws.onopen = () => setStatus('🟢 ONLINE: Scanning for nearby orders...');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_order_offer") {
        setOffer(data);
        new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(e => console.log("Sound blocked"));
      }
    };
    
    ws.onclose = () => setStatus('🔴 OFFLINE: Disconnected from server.');

    return () => ws.close();
  }, [isLoggedIn, riderId]); // Re-run whenever these change

  const acceptOrder = () => {
    alert("Order Accepted! Drive safe! 🛵");
    setOffer(null);
  }

  // --- THE LOGIN SCREEN ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-10 flex flex-col items-center">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
          <button onClick={goBack} className="mb-6 text-red-400 hover:text-red-300 font-bold transition">← Back to Home</button>
          <h2 className="text-3xl font-bold mb-4 text-red-400">Rider Login</h2>
          <p className="text-gray-400 mb-6">Enter your registered email address to go online.</p>
          
          <input 
            type="email" 
            placeholder="e.g. rider@localbite.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-2 focus:outline-none focus:border-red-500"
          />
          
          {loginError && <p className="text-red-400 mb-4 text-sm font-semibold">{loginError}</p>}
          
          <button 
            onClick={handleLogin} 
            className="w-full mt-4 bg-red-600 hover:bg-red-500 font-bold p-4 rounded-lg transition"
          >
            Authenticate & Go Online
          </button>
        </div>
      </div>
    )
  }

  // --- THE RADAR SCREEN ---
  return (
    <div className="min-h-screen bg-gray-900 text-white p-10 flex flex-col items-center">
      <div className="w-full max-w-md">
        <button onClick={() => { setIsLoggedIn(false); setRiderId(''); }} className="mb-6 text-red-400 hover:text-red-300 font-bold transition">
          ← Log Out
        </button>
        <h2 className="text-3xl font-bold mb-4 text-red-400">🛵 Rider Dashboard</h2>
        <p className="font-mono text-lg mb-6">{status}</p>

        {offer && (
          <div className="bg-gray-800 border-2 border-red-500 rounded-xl p-6 shadow-2xl animate-pulse">
            <h3 className="text-2xl font-bold text-red-500 mb-2">🚨 NEW ORDER NEAR YOU!</h3>
            <p className="text-lg mb-2"><span className="text-gray-400">Deliver to: </span> {offer.delivery_address}</p>
            <p className="text-xl font-bold text-green-400 mb-6">Earnings: ₹{offer.amount}</p>
            
            <button onClick={acceptOrder} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition transform hover:scale-105">
              Accept Order
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
// ==========================================
// 3. THE MAIN ROUTER (APP)
// ==========================================
function App() {
  const [currentRoute, setCurrentRoute] = useState('/')

  // Now we just render the separate components!
  if (currentRoute === '/customer') return <CustomerScreen goBack={() => setCurrentRoute('/')} />
  if (currentRoute === '/rider') return <RiderScreen goBack={() => setCurrentRoute('/')} />

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold text-green-400 mb-8 tracking-wider">LocalBite <span className="text-white">AI</span></h1>
      <div className="flex gap-4 flex-wrap justify-center">
        <button onClick={() => setCurrentRoute('/customer')} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg shadow-blue-500/30">
          🍔 Order Food (Customer)
        </button>
        <button onClick={() => setCurrentRoute('/rider')} className="bg-red-600 hover:bg-red-500 px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg shadow-red-500/30">
          🛵 Open Radar (Rider)
        </button>
      </div>
    </div>
  )
}

export default App