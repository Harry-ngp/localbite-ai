import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

const CONFIG = {
  success: { icon: '✓', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', accent: 'bg-emerald-500', text: 'text-emerald-300', title: 'Success' },
  error:   { icon: '✕', bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    accent: 'bg-rose-500',    text: 'text-rose-300',    title: 'Error' },
  warning: { icon: '!', bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   accent: 'bg-amber-400',   text: 'text-amber-300',   title: 'Warning' },
  info:    { icon: 'i', bg: 'bg-slate-700/40',   border: 'border-slate-600/30',   accent: 'bg-slate-400',   text: 'text-slate-300',   title: 'Info' },
};

function Toast({ toast, onClose }) {
  const c = CONFIG[toast.type] || CONFIG.info;
  return (
    <div
      className={`flex items-start gap-3 w-72 sm:w-80 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-toast-in ${c.bg} ${c.border}`}
      style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
    >
      {/* Accent icon */}
      <div className={`shrink-0 w-7 h-7 rounded-lg ${c.accent} flex items-center justify-center text-slate-950 font-black text-xs mt-0.5`}>
        {c.icon}
      </div>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black uppercase tracking-wider mb-0.5 ${c.text}`}>{c.title}</p>
        <p className="text-sm text-white font-medium leading-snug">{toast.message}</p>
      </div>
      {/* Close */}
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 text-slate-500 hover:text-white transition text-lg leading-none -mt-0.5 -mr-0.5 w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* Toast stack — bottom-right on desktop, bottom-center on mobile */}
      <div className="fixed z-[9999] bottom-safe flex flex-col gap-2.5 pointer-events-none"
        style={{
          bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          right: '1rem',
          left: 'auto',
        }}
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onClose={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
