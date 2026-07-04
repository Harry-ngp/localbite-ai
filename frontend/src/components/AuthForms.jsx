import React, { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { useToast } from './Toast';

export default function AuthForms({ activeRole, authMode, onLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Email/Login, 2: OTP Verify, 3: Create Password
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // Reset steps when authMode changes
  useEffect(() => {
    setStep(1);
    setEmail('');
    setName('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
  }, [authMode, activeRole]);

  // LOGIN HANDLER
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast('Please fill in all fields', 'error');
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: activeRole })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }
      
      const userData = await response.json();
      toast(`Welcome back, ${userData.name || userData.email}!`, 'success');
      onLogin(activeRole, userData.id, userData.email, userData.name); // Pass user ID, email and name to parent
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // SIGNUP STEP 1: SEND OTP
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) return toast('Please enter a valid email', 'error');

    setIsLoading(true);
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);

    try {
      const templateParams = {
        to_email: email,
        otp_code: newOtp,
        role: activeRole,
      };

      await emailjs.send(
        'service_8m246tt', // Service ID
        'template_p3vealp', // Template ID
        templateParams,
        '_wDLHMwnimd7Rpyfr' // Public Key
      );

      toast(`OTP sent successfully to ${email}`, 'success');
      setStep(2); // Move to OTP verification
    } catch (error) {
      console.error('EmailJS Error:', error);
      toast(`Failed to send email. Demo OTP: ${newOtp}`, 'warning');
      setStep(2); 
    } finally {
      setIsLoading(false);
    }
  };

  // SIGNUP STEP 2: VERIFY OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp === generatedOtp || otp === '1234') { // 1234 fallback for dev
      toast('Email verified successfully!', 'success');
      setStep(3); // Move to password creation
    } else {
      toast('Invalid OTP. Please try again.', 'error');
    }
  };

  // SIGNUP STEP 3: CREATE ACCOUNT
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast('Passwords do not match', 'error');
    }
    if (password.length < 6) {
      return toast('Password must be at least 6 characters', 'error');
    }
    if (!name.trim()) {
      return toast('Please enter your full name', 'error');
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: activeRole })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Signup failed');
      }
      
      const userData = await response.json();
      toast('Account created successfully!', 'success');
      onLogin(activeRole, userData.id, userData.email, userData.name);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER BLOCKS
  // -------------------------------------------------------------

  if (authMode === 'login') {
    return (
      <div className="w-full">
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6 animate-fade-in-up">
          <div className="relative group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`your@${activeRole}.com`}
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="login-email-input"
            />
            <label htmlFor="login-email-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Email Address
            </label>
          </div>

          <div className="relative group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="login-password-input"
            />
            <label htmlFor="login-password-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Password
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full relative group overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 mt-2"
          >
            <span className="relative z-10">{isLoading ? 'Logging In...' : 'Log In'}</span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
        </form>
      </div>
    );
  }

  // SIGNUP MODE
  return (
    <div className="w-full">
      {step === 1 && (
        <form onSubmit={handleSendOTP} className="flex flex-col gap-6 animate-fade-in-up">
          <div className="relative group">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`your@${activeRole}.com`}
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="signup-email-input"
            />
            <label htmlFor="signup-email-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Email Address
            </label>
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full relative group overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 mt-2"
          >
            <span className="relative z-10">{isLoading ? 'Sending OTP...' : 'Send OTP'}</span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOTP} className="flex flex-col gap-6 animate-fade-in-up">
          <div className="relative group">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="1234"
              maxLength={4}
              className="w-full text-center tracking-[1em] text-3xl font-black bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="otp-input"
            />
            <label htmlFor="otp-input" className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#0f172a] px-2 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-5 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Enter OTP from Email
            </label>
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full relative group overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 mt-2"
          >
             <span className="relative z-10">Verify OTP</span>
             <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-sm font-bold text-slate-500 hover:text-emerald-400 transition-colors">
            ← Change Email Address
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleCreateAccount} className="flex flex-col gap-6 animate-fade-in-up">
          <div className="relative group">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="signup-name-input"
            />
            <label htmlFor="signup-name-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Full Name
            </label>
          </div>

          <div className="relative group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="signup-password-input"
            />
            <label htmlFor="signup-password-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Create Password
            </label>
          </div>

          <div className="relative group">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl py-4 px-5 outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all shadow-inner peer placeholder-transparent"
              required
              disabled={isLoading}
              id="signup-confirm-password-input"
            />
            <label htmlFor="signup-confirm-password-input" className="absolute left-5 -top-2.5 bg-[#0f172a] px-1 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-500 peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-emerald-400">
              Confirm Password
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full relative group overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 mt-2"
          >
             <span className="relative z-10">{isLoading ? 'Creating...' : 'Create Account'}</span>
             <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
        </form>
      )}
    </div>
  );
}
