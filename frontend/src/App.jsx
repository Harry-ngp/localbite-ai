import React, { useState, useEffect } from 'react';
import CustomerScreen from './screens/CustomerScreen';
import PartnerScreen from './screens/PartnerScreen';
import RiderScreen from './screens/RiderScreen';
import { ToastProvider, useToast } from './components/Toast';

import AuthForms from './components/AuthForms';
function AuthGateway({ onLogin }) {
  const [activeRole, setActiveRole] = useState('customer');
  const [authMode, setAuthMode] = useState('login');

  const roles = [
    { id: 'customer', icon: '🍔', title: 'Customer' },
    { id: 'rider', icon: '🛵', title: 'Rider' },
    { id: 'partner', icon: '👨‍🍳', title: 'Partner' }
  ];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex overflow-hidden font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* 🚨 LEFT COLUMN - Advertising Showcase */}
      <div className="hidden lg:flex flex-col justify-center flex-1 relative p-20 z-10">
        
        {/* Animated Background Elements */}
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-teal-600/10 blur-[150px] rounded-full mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }}></div>

        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs font-bold text-emerald-400 tracking-widest uppercase mb-8 backdrop-blur-md animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Next-Gen Logistics
          </div>
          
          <h1 className="text-7xl xl:text-8xl font-black mb-6 tracking-tighter leading-[1.1] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            LocalBite <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 drop-shadow-[0_0_30px_rgba(52,211,153,0.3)]">
              AI Platform
            </span>
          </h1>
          
          <p className="text-slate-400 text-xl font-medium tracking-wide max-w-lg leading-relaxed mb-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            Empowering communities with hyper-fast deliveries, AI-driven taste matching, and zero-compromise partnerships.
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap gap-4 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            {['⚡ Under 15m Delivery', '🤖 AI Taste Engine', '🤝 Fair Partner Revenue'].map((feat, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-5 py-3 rounded-2xl backdrop-blur-sm text-sm font-bold text-slate-300 shadow-xl">
                <span className="text-emerald-400">✓</span> {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 🚨 RIGHT COLUMN - The Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-20">
        
        {/* Mobile Title (Hidden on Desktop) */}
        <div className="lg:hidden text-center mb-10 z-20">
          <h1 className="text-5xl font-black tracking-tighter">
            LocalBite <span className="text-emerald-400">AI</span>
          </h1>
        </div>

        <div className="w-full max-w-md animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          
          {/* Sleek Form Container */}
          <div className="relative group">
            {/* Animated Glow Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-b from-emerald-500/30 to-teal-500/10 rounded-[2.5rem] blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative bg-[#0f172a]/90 backdrop-blur-2xl border border-slate-700/50 p-10 rounded-[2.5rem] shadow-2xl">
              
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                <p className="text-slate-400 text-sm">Log in or create a new account to continue.</p>
              </div>

              {/* Role Tabs */}
              <div className="flex bg-slate-900/80 rounded-2xl p-1.5 mb-8 border border-slate-800 shadow-inner">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRole(r.id)}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 ${activeRole === r.id
                        ? 'bg-slate-800 text-emerald-400 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-slate-700/50'
                        : 'text-slate-500 hover:text-slate-300'
                      }`}
                  >
                    <span className="mr-2 text-base">{r.icon}</span>{r.title}
                  </button>
                ))}
              </div>

              {/* Auth Mode Toggle */}
              <div className="flex mb-8 border-b border-slate-800">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 pb-4 text-sm font-bold transition-all duration-300 ${authMode === 'login' ? 'text-white border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Log In
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 pb-4 text-sm font-bold transition-all duration-300 ${authMode === 'signup' ? 'text-white border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Create Account
                </button>
              </div>

              {/* Real Dynamic Auth Form Component */}
              <AuthForms activeRole={activeRole} authMode={authMode} onLogin={onLogin} />
              
              <div className="mt-8 text-center">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                  Secure OTP Authentication
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('lb_auth') === 'true');
  const [userId, setUserId] = useState(() => localStorage.getItem('lb_userId'));
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('lb_userEmail') || '');
  const [userName, setUserName] = useState(() => localStorage.getItem('lb_userName') || '');
  const [currentRoute, setCurrentRoute] = useState(() => localStorage.getItem('lb_route') || '/');
  const [globalOrders, setGlobalOrders] = useState(() => JSON.parse(localStorage.getItem('localbite_orders')) || []);
  const toast = useToast();

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

  const handleLogin = (role, id, email = '', name = '') => {
    setUserId(id);
    setUserEmail(email);
    setUserName(name);
    setIsAuthenticated(true);
    setCurrentRoute(`/${role}`);
    
    // Persist session
    localStorage.setItem('lb_auth', 'true');
    localStorage.setItem('lb_userId', id);
    localStorage.setItem('lb_userEmail', email);
    localStorage.setItem('lb_userName', name);
    localStorage.setItem('lb_route', `/${role}`);
    
    toast(`Successfully authenticated as ${role}!`, 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserEmail('');
    setUserName('');
    setCurrentRoute('/');
    
    // Clear session
    localStorage.removeItem('lb_auth');
    localStorage.removeItem('lb_userId');
    localStorage.removeItem('lb_userEmail');
    localStorage.removeItem('lb_userName');
    localStorage.removeItem('lb_route');
    
    toast('Logged out successfully', 'info');
  };

  if (!isAuthenticated) return <AuthGateway onLogin={handleLogin} />;

  if (currentRoute === '/customer') return <CustomerScreen goBack={handleLogout} addGlobalOrder={addGlobalOrder} currentCustomerId={userId} userEmail={userEmail} userName={userName} />;
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