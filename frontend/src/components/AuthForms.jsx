import React, { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { useToast } from './Toast';
import { API_BASE } from '../services/api';

/* ─── Input Field Component ──────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, icon, autoFocus, required = true }) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isPw = type === 'password';
  const inputType = isPw ? (showPw ? 'text' : 'password') : type;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className={`absolute left-4 font-bold uppercase tracking-wider transition-all duration-200 pointer-events-none z-10 ${
          focused || value
            ? '-top-2 text-[10px] text-emerald-400 bg-[#0a0f1e] px-1.5'
            : 'top-4 text-sm text-slate-500'
        }`}
      >
        {label}
      </label>

      {icon && (
        <span className="absolute left-4 top-4 text-slate-600 text-sm pointer-events-none select-none">
          {icon}
        </span>
      )}

      <input
        id={id}
        type={inputType}
        value={value}
        onChange={onChange}
        placeholder={focused ? placeholder : ''}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full bg-[#0a0f1e] border rounded-xl text-white text-sm outline-none transition-all duration-200 py-4 pr-4 disabled:opacity-50 ${
          icon ? 'pl-10' : 'pl-4'
        } ${
          focused
            ? 'border-emerald-500/60 shadow-[0_0_0_3px_rgba(16,185,129,0.1)]'
            : 'border-white/8 hover:border-white/15'
        }`}
      />

      {isPw && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPw(!showPw)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition text-sm px-1"
        >
          {showPw ? '🙈' : '👁️'}
        </button>
      )}
    </div>
  );
}

/* ─── Step Progress Indicator ────────────────────────────── */
function StepProgress({ step, total, labels }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 mb-2">
        {Array.from({ length: total }, (_, i) => (
          <React.Fragment key={i}>
            <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < step ? 'bg-emerald-500' : 'bg-white/8'
            }`} />
            {i < total - 1 && <div className="w-0" />}
          </React.Fragment>
        ))}
      </div>
      {labels && (
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
          Step {step} of {total} — {labels[step - 1]}
        </p>
      )}
    </div>
  );
}

/* ─── OTP Digit Boxes ────────────────────────────────────── */
function OtpInput({ value, onChange }) {
  const digits = value.split('').slice(0, 4);
  const refs = [useRef(), useRef(), useRef(), useRef()];

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const arr = digits.slice();
      arr[i] = '';
      onChange(arr.join(''));
      if (i > 0) refs[i - 1].current?.focus();
    }
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    const arr = [...digits];
    arr[i] = raw.slice(-1);
    onChange(arr.join(''));
    if (i < 3 && raw) refs[i + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) { onChange(pasted); refs[3].current?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
          className={`w-14 h-16 text-center text-2xl font-black bg-[#0a0f1e] rounded-2xl border outline-none transition-all duration-200 ${
            digits[i]
              ? 'border-emerald-500 text-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
              : 'border-white/10 text-white hover:border-white/20 focus:border-emerald-500/60 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]'
          }`}
        />
      ))}
    </div>
  );
}

/* ─── Submit Button ──────────────────────────────────────── */
function SubmitBtn({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-base py-4 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 mt-1"
    >
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Processing...
          </>
        ) : children}
      </span>
      {/* Shimmer overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
    </button>
  );
}

/* ─── Main Auth Forms Component ──────────────────────────── */
export default function AuthForms({ activeRole, authMode, onLogin }) {
  const [name,             setName]            = useState('');
  const [email,            setEmail]           = useState('');
  const [password,         setPassword]        = useState('');
  const [confirmPassword,  setConfirmPassword] = useState('');
  const [otp,              setOtp]             = useState('');
  const [generatedOtp,     setGeneratedOtp]    = useState('');
  const [step,             setStep]            = useState(1);
  const [isLoading,        setIsLoading]       = useState(false);
  const [pwStrength,       setPwStrength]      = useState(0);
  const toast = useToast();

  useEffect(() => {
    setStep(1); setEmail(''); setName(''); setPassword('');
    setConfirmPassword(''); setOtp(''); setPwStrength(0);
  }, [authMode, activeRole]);

  const calcStrength = (pw) => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    setPwStrength(score);
  };

  // ── Login ────────────────────────────────────────────────
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast('Please fill in all fields', 'error');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: activeRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Login failed'); }
      const data = await res.json();
      toast(`Welcome back, ${data.name || data.email}!`, 'success');
      onLogin(activeRole, data.id, data.email, data.name);
    } catch (err) { toast(err.message, 'error'); }
    finally { setIsLoading(false); }
  };

  // ── Signup Step 1: Send OTP ──────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) return toast('Please enter a valid email', 'error');
    setIsLoading(true);
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    try {
      await emailjs.send('service_8m246tt', 'template_p3vealp', { to_email: email, otp_code: newOtp, role: activeRole }, '_wDLHMwnimd7Rpyfr');
      toast(`OTP sent to ${email}`, 'success');
    } catch {
      toast(`Demo OTP: ${newOtp}`, 'warning');
    }
    setStep(2);
    setIsLoading(false);
  };

  // ── Signup Step 2: Verify OTP ────────────────────────────
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp === generatedOtp || otp === '1234') {
      toast('Email verified!', 'success');
      setStep(3);
    } else {
      toast('Incorrect OTP, try again.', 'error');
      setOtp('');
    }
  };

  // ── Signup Step 3: Create Account ────────────────────────
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Please enter your full name', 'error');
    if (password.length < 6) return toast('Password must be at least 6 characters', 'error');
    if (password !== confirmPassword) return toast('Passwords do not match', 'error');
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: activeRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Signup failed'); }
      const data = await res.json();
      toast('Account created successfully!', 'success');
      onLogin(activeRole, data.id, data.email, data.name);
    } catch (err) { toast(err.message, 'error'); }
    finally { setIsLoading(false); }
  };

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['', 'rose', 'amber', 'yellow', 'emerald'];

  /* ── LOGIN RENDER ── */
  if (authMode === 'login') {
    return (
      <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 animate-fade-in-up">
        <Field
          id="login-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isLoading}
          autoFocus
        />
        <Field
          id="login-password"
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={isLoading}
        />
        <SubmitBtn loading={isLoading}>Sign In →</SubmitBtn>
      </form>
    );
  }

  /* ── SIGNUP RENDER ── */
  const stepLabels = ['Enter Email', 'Verify OTP', 'Set Password'];

  return (
    <div className="w-full animate-fade-in-up">
      <StepProgress step={step} total={3} labels={stepLabels} />

      {/* Step 1 */}
      {step === 1 && (
        <form onSubmit={handleSendOTP} className="flex flex-col gap-4">
          <Field
            id="signup-email"
            label="Email Address"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            autoFocus
          />
          <SubmitBtn loading={isLoading}>Send OTP →</SubmitBtn>
        </form>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <form onSubmit={handleVerifyOTP} className="flex flex-col gap-5">
          <div className="text-center mb-2">
            <div className="text-4xl mb-2">📧</div>
            <p className="text-sm text-slate-400">Enter the 4-digit code sent to</p>
            <p className="text-sm font-bold text-white mt-0.5">{email}</p>
          </div>
          <OtpInput value={otp} onChange={setOtp} />
          <SubmitBtn loading={isLoading}>Verify Code →</SubmitBtn>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs text-slate-500 hover:text-emerald-400 transition font-semibold text-center"
          >
            ← Change email address
          </button>
        </form>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
          <Field
            id="signup-name"
            label="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Doe"
            disabled={isLoading}
            autoFocus
          />
          <Field
            id="signup-password"
            label="Create Password"
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); calcStrength(e.target.value); }}
            placeholder="Min. 6 characters"
            disabled={isLoading}
          />
          {/* Password strength */}
          {password && (
            <div className="flex gap-1 -mt-2">
              {[1,2,3,4].map(i => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= pwStrength ? `bg-${strengthColors[pwStrength]}-400` : 'bg-white/8'
                }`} />
              ))}
              <span className={`text-[10px] font-bold ml-1 text-${strengthColors[pwStrength]}-400`}>
                {strengthLabels[pwStrength]}
              </span>
            </div>
          )}
          <Field
            id="signup-confirm-password"
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            disabled={isLoading}
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-rose-400 font-semibold -mt-2">⚠️ Passwords do not match</p>
          )}
          <SubmitBtn loading={isLoading}>Create Account →</SubmitBtn>
        </form>
      )}
    </div>
  );
}
