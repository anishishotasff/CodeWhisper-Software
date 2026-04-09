import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput from './PhoneInput';

const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY || 'AIzaSyAUM5eXoSob0rQQ3J8_kLTZNlAIdqu0OLI';
const FIREBASE_AUTH_DOMAIN = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'codewhisper-66d6d.firebaseapp.com';
const BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

async function firebaseSignIn(email, password) {
  const res = await fetch(`${BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(friendlyError(data.error.message));
  return data;
}

async function firebaseSignUp(email, password) {
  const res = await fetch(`${BASE}:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(friendlyError(data.error.message));
  return data;
}

async function firebaseGoogleSignIn() {
  if (window.electronAPI && window.electronAPI.googleSignIn) {
    const result = await window.electronAPI.googleSignIn();
    if (result.error) {
      if (result.error === 'cancelled') throw new Error('cancelled');
      throw new Error(result.error);
    }
    return { localId: result.uid, email: result.email };
  }
  throw new Error('Google sign-in not available');
}

// Phone OTP via Firebase REST
async function sendPhoneOtp(phone) {
  // Firebase phone auth REST requires a recaptcha token
  // We use a test token approach — works for verified test numbers
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, recaptchaToken: 'test-reCAPTCHA-token' }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.sessionInfo;
}

async function verifyPhoneOtp(sessionInfo, code) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionInfo, code }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error('Invalid OTP. Please try again.');
  return data;
}

function friendlyError(msg) {
  const map = {
    'EMAIL_EXISTS': 'This email is already registered.',
    'INVALID_EMAIL': 'Invalid email address.',
    'WEAK_PASSWORD : Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'INVALID_PASSWORD': 'Incorrect password.',
    'EMAIL_NOT_FOUND': 'No account found with this email.',
    'INVALID_LOGIN_CREDENTIALS': 'Invalid email or password.',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Try again later.',
  };
  return map[msg] || msg.replace(/_/g, ' ').toLowerCase();
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f5f9', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 10,
};

export default function AuthScreen({ onAuth, onSkip }) {
  const [mode, setMode] = useState('login');
  const [authMethod, setAuthMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const data = mode === 'login' ? await firebaseSignIn(email, password) : await firebaseSignUp(email, password);
      onAuth({ uid: data.localId, email: data.email, isNew: mode === 'signup' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) { setError('Enter a phone number with country code'); return; }
    setError(''); setLoading(true);
    try {
      const info = await sendPhoneOtp(phone);
      setSessionInfo(info); setOtpSent(true);
    } catch (err) {
      setError('Phone OTP requires reCAPTCHA verification. Use email/password instead for now.');
    }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6 || !sessionInfo) return;
    setError(''); setLoading(true);
    try {
      const data = await verifyPhoneOtp(sessionInfo, otp);
      onAuth({ uid: data.localId, email: data.phoneNumber || phone, isNew: false });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setError(''); setGoogleLoading(true);
    try {
      const data = await firebaseGoogleSignIn();
      onAuth({ uid: data.localId, email: data.email, isNew: false });
    } catch (err) {
      if (err.message !== 'cancelled') setError(err.message || 'Google sign-in failed');
    }
    finally { setGoogleLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(10,10,15,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)' }}
    >
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 500, height: 400, background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ width: 380, background: 'rgba(15,15,26,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }} />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🪄</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>
            Code<span style={{ background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Whisper</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 3 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </div>
          {mode === 'signup' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '3px 10px', borderRadius: 100, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', fontSize: 10, color: '#a855f7', fontWeight: 600 }}>
              🎁 100 free credits on signup
            </div>
          )}
        </div>

        {/* Sign In / Sign Up tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, marginBottom: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setOtpSent(false); setOtp(''); }}
              style={{ flex: 1, padding: '6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s', background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent', color: mode === m ? '#a855f7' : 'rgba(241,245,249,0.4)' }}
            >{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        {/* Email / Phone tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['email', 'phone'].map(m => (
            <button key={m} onClick={() => { setAuthMethod(m); setError(''); setOtpSent(false); setOtp(''); }}
              style={{ flex: 1, padding: '6px', borderRadius: 8, border: `1px solid ${authMethod === m ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', background: authMethod === m ? 'rgba(124,58,237,0.15)' : 'transparent', color: authMethod === m ? '#a855f7' : 'rgba(241,245,249,0.4)' }}
            >{m === 'email' ? '✉️ Email' : '📱 Phone OTP'}</button>
          ))}
        </div>

        {/* Email form */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email address" style={inputStyle} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" style={inputStyle} />
            {mode === 'signup' && (
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Confirm password" style={inputStyle} />
            )}
            {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: '#f87171' }}>{error}</div>}
            <motion.button type="submit" disabled={loading}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: loading ? 0.7 : 1, boxShadow: '0 0 20px rgba(124,58,237,0.4)', marginBottom: 10 }}
              whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
            >{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</motion.button>
          </form>
        )}

        {/* Phone OTP form */}
        {authMethod === 'phone' && (
          <div>
            {!otpSent ? (
              <>
                <div style={{ fontSize: 10, color: 'rgba(241,245,249,0.4)', marginBottom: 6 }}>Include country code (e.g. +91 9876543210)</div>
                <PhoneInput value={phone} onChange={setPhone} />
                {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: '#f87171' }}>{error}</div>}
                <motion.button onClick={handleSendOtp} disabled={loading}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', opacity: loading ? 0.7 : 1, marginBottom: 10 }}
                  whileHover={!loading ? { scale: 1.02 } : {}} whileTap={!loading ? { scale: 0.98 } : {}}
                >{loading ? 'Sending...' : 'Send OTP'}</motion.button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', marginBottom: 10, textAlign: 'center' }}>
                  OTP sent to {phone}
                  <button onClick={() => { setOtpSent(false); setOtp(''); }} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 10, marginLeft: 6 }}>Change</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <input key={i} type="text" maxLength={1} value={otp[i] || ''} id={`otp-d-${i}`}
                      onChange={e => { const v = e.target.value.replace(/\D/g,''); const arr = otp.split(''); arr[i] = v; setOtp(arr.join('').slice(0,6)); if (v && i < 5) document.getElementById(`otp-d-${i+1}`)?.focus(); }}
                      style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${otp[i] ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`, color: '#f1f5f9', fontSize: 16, fontWeight: 700, outline: 'none' }}
                    />
                  ))}
                </div>
                {error && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: '#f87171' }}>{error}</div>}
                <motion.button onClick={handleVerifyOtp} disabled={loading || otp.length < 6}
                  style={{ width: '100%', padding: '10px', borderRadius: 10, background: otp.length === 6 ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'rgba(255,255,255,0.05)', color: '#fff', border: 'none', cursor: otp.length < 6 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', marginBottom: 10 }}
                  whileHover={otp.length === 6 && !loading ? { scale: 1.02 } : {}} whileTap={otp.length === 6 && !loading ? { scale: 0.98 } : {}}
                >{loading ? 'Verifying...' : 'Verify OTP'}</motion.button>
              </>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: 'rgba(241,245,249,0.3)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Google */}
        <motion.button type="button" onClick={handleGoogle} disabled={googleLoading}
          style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f1f5f9', cursor: googleLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: googleLoading ? 0.7 : 1, marginBottom: 10 }}
          whileHover={!googleLoading ? { background: 'rgba(255,255,255,0.1)' } : {}} whileTap={!googleLoading ? { scale: 0.98 } : {}}
        >
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Signing in...' : 'Continue with Google'}
        </motion.button>

        {/* Skip */}
        <button onClick={onSkip} style={{ width: '100%', padding: '8px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(241,245,249,0.3)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          Continue without account (use own API key)
        </button>
      </motion.div>
    </motion.div>
  );
}
