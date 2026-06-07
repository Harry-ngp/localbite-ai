import React, { useState, useEffect } from 'react';
import CustomerScreen from './screens/CustomerScreen';
import PartnerScreen from './screens/PartnerScreen';
import RiderScreen from './screens/RiderScreen';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('/');
  
  // THE MAGIC SYNC ENGINE V2 (BULLETPROOF)
  const [globalOrders, setGlobalOrders] = useState(() => JSON.parse(localStorage.getItem('localbite_orders')) || []);

  // 🚨 CRITICAL FIX: Only LISTEN to other tabs. Never aggressively overwrite them on render!
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'localbite_orders') {
        setGlobalOrders(JSON.parse(e.newValue) || []);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []); // <-- Empty array stops the infinite wipe loop!

  // Safely write to storage ONLY when a specific action happens
  const addGlobalOrder = (order) => {
    setGlobalOrders(prev => {
      const updatedOrders = [order, ...prev];
      localStorage.setItem('localbite_orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });
  };

  const updateGlobalOrderStatus = (id, newStatus, extraData = {}) => {
    setGlobalOrders(prev => {
      const updatedOrders = prev.map(o => o.id === id ? { ...o, status: newStatus, ...extraData } : o);
      localStorage.setItem('localbite_orders', JSON.stringify(updatedOrders));
      return updatedOrders;
    });
  };

  if (currentRoute === '/customer') return <CustomerScreen goBack={() => setCurrentRoute('/')} addGlobalOrder={addGlobalOrder} />;
  if (currentRoute === '/partner') return <PartnerScreen goBack={() => setCurrentRoute('/')} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />;
  if (currentRoute === '/rider') return <RiderScreen goBack={() => setCurrentRoute('/')} globalOrders={globalOrders} updateGlobalOrderStatus={updateGlobalOrderStatus} />;

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
        <button onClick={() => setCurrentRoute('/customer')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-emerald-500/20 hover:border-emerald-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:rotate-6 transition duration-500 origin-left">🍔</div>
            <h3 className="text-3xl font-bold text-white mb-3">Order Food</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Discover nearby restaurants and track your delivery in real-time on the map.</p>
          </div>
        </button>
        
        <button onClick={() => setCurrentRoute('/rider')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-rose-500/20 hover:border-rose-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(244,63,94,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:-translate-x-2 transition duration-500 origin-left">🛵</div>
            <h3 className="text-3xl font-bold text-white mb-3">Drive & Earn</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Accept ready orders and trigger the live GPS driving simulation.</p>
          </div>
        </button>

        <button onClick={() => setCurrentRoute('/partner')} className="flex-1 group bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-xl border border-amber-500/20 hover:border-amber-500/50 p-10 rounded-[2.5rem] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.3)] text-left flex flex-col justify-between min-h-[300px]">
          <div>
            <div className="text-6xl mb-6 transform group-hover:scale-110 group-hover:-rotate-6 transition duration-500 origin-left">👨‍🍳</div>
            <h3 className="text-3xl font-bold text-white mb-3">Partner Kitchen</h3>
            <p className="text-slate-400 text-lg leading-relaxed">Accept incoming orders, cook the food, and mark it ready for the rider.</p>
          </div>
        </button>
      </div>
    </div>
  );
}