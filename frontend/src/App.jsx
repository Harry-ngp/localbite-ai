import React, { useState, useEffect, useRef } from 'react';
import CustomerScreen from './screens/CustomerScreen';
import PartnerScreen from './screens/PartnerScreen';
import RiderScreen from './screens/RiderScreen';
import { ToastProvider, useToast } from './components/Toast';
import AuthForms from './components/AuthForms';

/* ─── Floating Particle ───────────────────────────────────── */
function FloatingEmoji({ emoji, style }) {
  return (
    <div
      className="absolute select-none pointer-events-none text-4xl opacity-20 animate-float"
      style={style}
    >
      {emoji}
    </div>
  );
}

/* ─── Feature Stat ────────────────────────────────────────── */
function FeatureStat({ value, label, icon }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm">
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-black gradient-text">{value}</span>
      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ─── Auth Gateway (Landing + Login) ─────────────────────── */
function AuthGateway({ onLogin }) {
  const [activeRole, setActiveRole] = useState('customer');
  const [authMode, setAuthMode] = useState('login');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const roles = [
    { id: 'customer', icon: '🍔', title: 'Customer', color: 'emerald',
      desc: 'Order from local restaurants', grad: 'from-emerald-500/20 to-teal-500/10' },
    { id: 'rider',   icon: '🛵', title: 'Rider',    color: 'amber',
      desc: 'Deliver & earn money',        grad: 'from-amber-500/20 to-orange-500/10' },
    { id: 'partner', icon: '🍳', title: 'Partner',  color: 'violet',
      desc: 'Manage your restaurant',      grad: 'from-violet-500/20 to-purple-500/10' },
  ];

  const particles = [
    { emoji: '🍕', style: { top: '10%', left: '8%',  animationDelay: '0s',   animationDuration: '5s' } },
    { emoji: '🍜', style: { top: '25%', left: '85%', animationDelay: '1.2s', animationDuration: '6s' } },
    { emoji: '🍣', style: { top: '55%', left: '5%',  animationDelay: '2.4s', animationDuration: '7s' } },
    { emoji: '🌮', style: { top: '70%', left: '88%', animationDelay: '0.6s', animationDuration: '5.5s' } },
    { emoji: '🍔', style: { top: '40%', left: '92%', animationDelay: '1.8s', animationDuration: '4.5s' } },
    { emoji: '🥗', style: { top: '80%', left: '15%', animationDelay: '3s',   animationDuration: '6.5s' } },
    { emoji: '🍦', style: { top: '15%', left: '60%', animationDelay: '0.9s', animationDuration: '5s' } },
    { emoji: '☕', style: { top: '60%', left: '45%', animationDelay: '2.1s', animationDuration: '7s' } },
  ];

  const stats = [
    { value: '50+', label: 'Restaurants', icon: '🏪' },
    { value: '15m', label: 'Avg Delivery', icon: '⚡' },
    { value: '4.9★', label: 'Avg Rating',  icon: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-mesh-1 text-white flex overflow-hidden font-sans relative">

      {/* Ambient blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-teal-600/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] max-w-[400px] max-h-[400px] bg-cyan-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Floating food emojis */}
      {particles.map((p, i) => <FloatingEmoji key={i} emoji={p.emoji} style={p.style} />)}

      {/* ── LEFT PANEL — Hero ── */}
      <div className="hidden lg:flex flex-col justify-center flex-1 relative p-16 xl:p-24 z-10">
        <div className={`relative z-10 max-w-xl transition-all duration-700 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>

          {/* Live badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border border-emerald-500/20 text-xs font-bold text-emerald-400 tracking-widest uppercase mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            AI-Powered Food Delivery
          </div>

          {/* Headline */}
          <h1 className="text-fluid-hero font-black tracking-tighter leading-[0.95] mb-6">
            <span className="block text-white">Local</span>
            <span className="block gradient-text">Bite AI</span>
          </h1>

          <p className="text-slate-400 text-lg xl:text-xl font-medium leading-relaxed mb-10 max-w-md">
            Hyper-fast deliveries, AI taste matching, and real-time tracking — all in one platform built for your city.
          </p>

          {/* Stats row */}
          <div className="flex gap-3 mb-12 flex-wrap">
            {stats.map((s, i) => (
              <FeatureStat key={i} {...s} />
            ))}
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3">
            {[
              { icon: '🤖', text: 'AI Vibe Search — find food by mood' },
              { icon: '⚡', text: 'Real-time GPS tracking on every order' },
              { icon: '🔒', text: 'Secure OTP authentication built-in' },
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-slate-300 font-medium animate-fade-in-up"
                style={{ animationDelay: `${300 + i * 100}ms` }}
              >
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-base shrink-0">
                  {feat.icon}
                </span>
                {feat.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 relative z-20 min-h-screen">

        {/* Mobile header */}
        <div className="lg:hidden text-center mb-8 animate-fade-in-down">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/30">
              🍔
            </div>
            <h1 className="text-4xl font-black tracking-tighter">
              Local<span className="gradient-text">Bite</span>
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">AI-Powered Food Delivery</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-md animate-scale-in" style={{ animationDelay: '100ms' }}>
          <div className="relative">
            {/* Glow border */}
            <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-emerald-500/30 via-teal-500/10 to-transparent opacity-60 blur-sm pointer-events-none" />

            {/* Main card */}
            <div className="relative glass-dark rounded-[1.75rem] p-7 sm:p-9 shadow-2xl">

              {/* Logo row (desktop only) */}
              <div className="hidden lg:flex items-center gap-2.5 mb-8">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/30">
                  🍔
                </div>
                <span className="font-black text-lg">Local<span className="gradient-text">Bite AI</span></span>
              </div>

              <div className="mb-7">
                <h2 className="text-2xl font-black text-white mb-1">
                  {authMode === 'login' ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {authMode === 'login' ? 'Sign in to continue ordering.' : 'Join thousands of users.'}
                </p>
              </div>

              {/* Role selector */}
              <div className="mb-6">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">I am a</p>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(r => (
                    <button
                      key={r.id}
                      id={`role-${r.id}`}
                      onClick={() => setActiveRole(r.id)}
                      className={`relative flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-2xl border font-bold text-xs transition-all duration-200 ${
                        activeRole === r.id
                          ? `bg-gradient-to-b ${r.grad} border-${r.color}-500/40 text-${r.color === 'emerald' ? 'emerald' : r.color === 'amber' ? 'amber' : 'violet'}-400 shadow-lg`
                          : 'bg-white/3 border-white/6 text-slate-500 hover:text-slate-300 hover:border-white/12 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-2xl">{r.icon}</span>
                      <span className="tracking-wide uppercase text-[10px]">{r.title}</span>
                      {activeRole === r.id && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#020617] shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Login / Signup toggle */}
              <div className="flex gap-0 mb-6 bg-white/4 rounded-xl p-1 border border-white/6">
                {[
                  { mode: 'login',  label: 'Sign In' },
                  { mode: 'signup', label: 'Register' },
                ].map(({ mode, label }) => (
                  <button
                    key={mode}
                    id={`auth-mode-${mode}`}
                    onClick={() => setAuthMode(mode)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                      authMode === mode
                        ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Dynamic auth form */}
              <AuthForms activeRole={activeRole} authMode={authMode} onLogin={onLogin} />

              {/* Footer */}
              <div className="mt-7 pt-5 border-t border-white/5 flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[11px] text-slate-600 font-semibold tracking-wider uppercase">
                  Secured with OTP Verification
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="mt-6 text-xs text-slate-700 font-medium text-center animate-fade-in" style={{ animationDelay: '400ms' }}>
          By continuing, you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}

/* ─── Main Application Shell ─────────────────────────────── */
function MainApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('lb_auth') === 'true');
  const [userId,       setUserId]       = useState(() => localStorage.getItem('lb_userId'));
  const [userEmail,    setUserEmail]    = useState(() => localStorage.getItem('lb_userEmail') || '');
  const [userName,     setUserName]     = useState(() => localStorage.getItem('lb_userName') || '');
  const [currentRoute, setCurrentRoute] = useState(() => localStorage.getItem('lb_route') || '/');
  const [globalOrders, setGlobalOrders] = useState(() => JSON.parse(localStorage.getItem('localbite_orders')) || []);
  const toast = useToast();

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'localbite_orders') setGlobalOrders(JSON.parse(e.newValue) || []);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addGlobalOrder = (order) => {
    setGlobalOrders(prev => {
      const updated = [order, ...prev];
      localStorage.setItem('localbite_orders', JSON.stringify(updated));
      return updated;
    });
    toast(`Order placed successfully!`, 'success');
  };

  const updateGlobalOrderStatus = (id, newStatus, extra = {}) => {
    setGlobalOrders(prev => {
      const updated = prev.map(o => o.id === id ? { ...o, status: newStatus, ...extra } : o);
      localStorage.setItem('localbite_orders', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogin = (role, id, email = '', name = '') => {
    setUserId(id); setUserEmail(email); setUserName(name);
    setIsAuthenticated(true); setCurrentRoute(`/${role}`);
    localStorage.setItem('lb_auth', 'true');
    localStorage.setItem('lb_userId', id);
    localStorage.setItem('lb_userEmail', email);
    localStorage.setItem('lb_userName', name);
    localStorage.setItem('lb_route', `/${role}`);
    toast(`Welcome${name ? ', ' + name : ''}! 👋`, 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setUserId(null); setUserEmail(''); setUserName(''); setCurrentRoute('/');
    localStorage.removeItem('lb_auth'); localStorage.removeItem('lb_userId');
    localStorage.removeItem('lb_userEmail'); localStorage.removeItem('lb_userName');
    localStorage.removeItem('lb_route');
    toast('Signed out successfully', 'info');
  };

  if (!isAuthenticated) return <AuthGateway onLogin={handleLogin} />;
  if (currentRoute === '/customer') return (
    <CustomerScreen goBack={handleLogout} addGlobalOrder={addGlobalOrder} currentCustomerId={userId} userEmail={userEmail} userName={userName} />
  );
  if (currentRoute === '/partner') return (
    <PartnerScreen goBack={handleLogout} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />
  );
  if (currentRoute === '/rider') return (
    <RiderScreen goBack={handleLogout} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />
  );
  return null;
}

/* ─── Root ───────────────────────────────────────────────── */
export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}