import React, { useState, useEffect } from 'react';
import CustomerScreen from './screens/CustomerScreen';
import PartnerScreen from './screens/PartnerScreen';
import RiderScreen from './screens/RiderScreen';
import { ToastProvider, useToast } from './components/Toast';

function AuthGateway({ onLogin }) {
  const [activeRole, setActiveRole] = useState('customer');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Email, 2: Enter OTP
  const toast = useToast();

  const handleSendOTP = (e) => {
    e.preventDefault();
    if (!email) return toast('Please enter a valid email', 'error');
    // Simulate Backend generating OTP
    toast(`OTP sent to ${email} (Mock: 1234)`, 'success');
    setStep(2);
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (otp === '1234') {
      onLogin(activeRole);
    } else {
      toast('Invalid OTP. Use 1234 for testing.', 'error');
    }
  };

  const roles = [
    { id: 'customer', icon: '🍔', title: 'Customer' },
    { id: 'rider', icon: '🛵', title: 'Rider' },
    { id: 'partner', icon: '👨‍🍳', title: 'Partner' }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">

      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-rose-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] bg-amber-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="z-10 text-center mb-8 mt-8">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-sm font-medium text-slate-300 tracking-widest uppercase shadow-lg shadow-emerald-500/10">
          Intelligent Delivery Platform
        </div>
        <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 drop-shadow-2xl">
          LocalBite <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">AI</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl font-medium tracking-wide max-w-xl mx-auto leading-relaxed">
          Log in or sign up to experience the future of hyperlocal logistics.
        </p>
      </div>

      <div className="w-full max-w-md z-10 bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-8 rounded-[2rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">

        {/* Role Tabs */}
        <div className="flex bg-slate-800/50 rounded-xl p-1 mb-8">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => { setActiveRole(r.id); setStep(1); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 ${activeRole === r.id
                  ? 'bg-slate-700 text-white shadow-md border border-white/10'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <span className="mr-2">{r.icon}</span>{r.title}
            </button>
          ))}
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex justify-center gap-6 mb-8 text-sm font-bold">
          <button
            onClick={() => { setAuthMode('login'); setStep(1); }}
            className={`transition-colors ${authMode === 'login' ? 'text-emerald-400 border-b-2 border-emerald-400 pb-1' : 'text-slate-400 hover:text-white pb-1'}`}
          >
            Log In
          </button>
          <button
            onClick={() => { setAuthMode('signup'); setStep(1); }}
            className={`transition-colors ${authMode === 'signup' ? 'text-emerald-400 border-b-2 border-emerald-400 pb-1' : 'text-slate-400 hover:text-white pb-1'}`}
          >
            Sign Up
          </button>
        </div>

        {/* The Forms */}
        {step === 1 ? (
          <form onSubmit={handleSendOTP} className="flex flex-col gap-5 animate-fade-in-up">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-800/80 border border-slate-700 text-white rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20">
              {authMode === 'login' ? 'Send Login OTP' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="flex flex-col gap-5 animate-fade-in-up">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Enter OTP Sent to {email}</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="1234"
                maxLength={4}
                className="w-full text-center tracking-[0.5em] text-2xl bg-slate-800/80 border border-slate-700 text-white rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                required
              />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black py-3.5 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20">
              Verify & Enter
            </button>
            <button type="button" onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-white mt-2">
              ← Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function MainApp() {
  const [currentRoute, setCurrentRoute] = useState('/');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const toast = useToast();

  // THE MAGIC SYNC ENGINE V2
  const [globalOrders, setGlobalOrders] = useState(() => JSON.parse(localStorage.getItem('localbite_orders')) || []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'localbite_orders') {
        setGlobalOrders(JSON.parse(e.newValue) || []);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addGlobalOrder = (order) => {
    setGlobalOrders(prev => {
      const updatedOrders = [order, ...prev];
      localStorage.setItem('localbite_orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });
    toast(`Order ${order.id.slice(0, 8)} placed successfully!`, 'success');
  };

  const updateGlobalOrderStatus = (id, newStatus, extraData = {}) => {
    setGlobalOrders(prev => {
      const updatedOrders = prev.map(o => o.id === id ? { ...o, status: newStatus, ...extraData } : o);
      localStorage.setItem('localbite_orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });
  };

  const handleLogin = (role) => {
    setSelectedRole(role);
    setIsAuthenticated(true);
    setCurrentRoute(`/${role}`);
    toast(`Successfully authenticated as ${role}!`, 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSelectedRole(null);
    setCurrentRoute('/');
    toast('Logged out successfully', 'info');
  };

  if (!isAuthenticated) return <AuthGateway onLogin={handleLogin} />;

  if (currentRoute === '/customer') return <CustomerScreen goBack={handleLogout} addGlobalOrder={addGlobalOrder} />;
  if (currentRoute === '/partner') return <PartnerScreen goBack={handleLogout} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />;
  if (currentRoute === '/rider') return <RiderScreen goBack={handleLogout} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />;

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}