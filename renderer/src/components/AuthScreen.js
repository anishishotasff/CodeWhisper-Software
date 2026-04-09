import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY || '';
const FIREBASE_AUTH_DOMAIN = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '';
const BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

// ── Email/Password — pure REST, no domain check ───────────────────────────────
async function firebaseSignIn(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured. Add API key to .env');
  const res = await fetch(`${BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(friendlyError(data.error.message));
  return data;
}

async function firebaseSignUp(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured. Add API key to .env');
  const res = await fetch(`${BASE}:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(friendlyError(data.error.message));
  return data;
}

// ── Google — exchange Google ID token via REST (no domain check) ──────────────
async function firebaseGoogleSignIn() {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured');
  if (!FIREBASE_AUTH_DOMAIN) throw new Error('Firebase auth domain not configured');

  // Step 1: Get Google OAuth token by opening a popup to Firebase's hosted auth page
  // This page is on firebaseapp.com which is always authorized
  const googleToken = await getGoogleTokenViaPopup();
  if (!googleToken) throw new Error('Google sign-in was cancelled');

  // Step 2: Exchange the Google token with Firebase REST API (no domain check)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${googleToken}&providerId=google.com`,
        requestUri: `https://${FIREBASE_AUTH_DOMAIN}`,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(friendlyError(data.error.message));
  return { localId: data.localId, email: data.email };
}

// Opens a small popup window to Firebase's hosted Google auth page
function getGoogleTokenViaPopup() {
  return new Promise((resolve) => {
    const authUrl = `https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler?` +
      `apiKey=${FIREBASE_API_KEY}` +
      `&providerId=google.com` +
      `&scopes=email%20profile` +
      `&redirectUrl=${encodeURIComponent(`https://${FIREBASE_AUTH_DOMAIN}/__/auth/handler`)}` +
      `&v=9`;

    const popup = window.open(authUrl, 'googleAuth', 'width=500,height=650,scrollbars=yes');

    if (!popup) {
      resolve(null);
      return;
    }

    const timer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(timer);
          resolve(null);
          return;
        }
        const url = popup.location.href;
        if (url && url.includes('id_token=')) {
          const match = url.match(/id_token=([^&]+)/);
          if (match) {
            clearInterval(timer);
            popup.close();
            resolve(decodeURIComponent(match[1]));
          }
        }
      } catch {
        // Cross-origin — keep waiting
      }
    }, 500);

    // Timeout after 3 minutes
    setTimeout(() => {
      clearInterval(timer);
      if (!popup.closed) popup.close();
      resolve(null);
    }, 180000);
  });
}

function friendlyError(msg) {
  const map = {
    'EMAIL_EXISTS': 'This email is already registered. Try signing in.',
    'INVALID_EMAIL': 'Invalid email address.',
    'WEAK_PASSWORD : Password should be at least 6 characters': 'Password must be at least 6 characters.',
    'INVALID_PASSWORD': 'Incorrect password.',
    'EMAIL_NOT_FOUND': 'No account found with this email.',
    'USER_DISABLED': 'This account has been disabled.',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many attempts. Try again later.',
  };
  return map[msg] || msg.replace(/_/g, ' ').toLowerCase();
}

export default function AuthScreen({ onAuth, onSkip }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await firebaseSignIn(email, password)
        : await firebaseSignUp(email, password);
      onAuth({ uid: data.localId, email: data.email, isNew: mode === 'signup' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const data = await firebaseGoogleSignIn();
      onAuth({ uid: data.localId, email: data.email, isNew: false });
    } catch (err) {
      if (err.message !== 'Google sign-in was cancelled') {
        setError(err.message || 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f1f5f9', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    marginBottom: 12,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,10,15,0.97)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 500, height: 400,
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          width: 380, background: 'rgba(15,15,26,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '36px 32px',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
        }} />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🪄</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            Code<span style={{
              background: 'linear-gradient(135deg,#7c3aed,#06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Whisper</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginTop: 4 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </div>
          {mode === 'signup' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              marginTop: 10, padding: '4px 12px', borderRadius: 100,
              background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)',
              fontSize: 11, color: '#a855f7', fontWeight: 600,
            }}>
              🎁 100 free credits on signup
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)',
          borderRadius: 10, padding: 3, marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '7px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', transition: 'all 0.2s',
                background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: mode === m ? '#a855f7' : 'rgba(241,245,249,0.4)',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Google button — at top */}
        <motion.button
          type="button" onClick={handleGoogle} disabled={googleLoading}
          style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#f1f5f9', cursor: googleLoading ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: googleLoading ? 0.7 : 1, marginBottom: 14,
          }}
          whileHover={!googleLoading ? { background: 'rgba(255,255,255,0.1)' } : {}}
          whileTap={!googleLoading ? { scale: 0.98 } : {}}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? 'Opening Google...' : 'Continue with Google'}
        </motion.button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.3)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="Email address" style={inputStyle} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="Password" style={inputStyle} />
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.input
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="Confirm password" style={inputStyle}
              />
            )}
          </AnimatePresence>

          {error && (
            <div style={{
              marginBottom: 12, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: 12, color: '#f87171',
            }}>
              {error}
            </div>
          )}

          <motion.button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 0 24px rgba(124,58,237,0.4)',
              marginBottom: 12,
            }}
            whileHover={!loading ? { scale: 1.02 } : {}}
            whileTap={!loading ? { scale: 0.98 } : {}}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </motion.button>
        </form>

        <button onClick={onSkip} style={{
          width: '100%', padding: '9px', borderRadius: 10,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(241,245,249,0.35)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'inherit',
        }}>
          Continue without account (use own API key)
        </button>
      </motion.div>
    </motion.div>
  );
}
