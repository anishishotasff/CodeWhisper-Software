import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple Firebase REST API calls — no SDK needed in Electron renderer
const FIREBASE_API_KEY = process.env.REACT_APP_FIREBASE_API_KEY || '';
const BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';

async function firebaseSignIn(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured');
  const res = await fetch(`${BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message.replace(/_/g, ' ').toLowerCase());
  return data;
}

async function firebaseSignUp(email, password) {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured');
  const res = await fetch(`${BASE}:signUp?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message.replace(/_/g, ' ').toLowerCase());
  return data;
}

// Google sign-in for Electron — uses Firebase REST API with OAuth token
async function firebaseGoogleSignIn() {
  if (!FIREBASE_API_KEY) throw new Error('Firebase not configured');

  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');

  const config = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  auth.settings = auth.settings || {};

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  try {
    const result = await signInWithPopup(auth, provider);
    return { localId: result.user.uid, email: result.user.email };
  } catch (err) {
    // If popup fails (e.g. in packaged Electron), give a clear message
    if (err.code === 'auth/unauthorized-domain') {
      throw new Error('Google sign-in requires adding "localhost" to Firebase authorized domains. Use email/password instead.');
    }
    throw err;
  }
}

export default function AuthScreen({ onAuth, onSkip }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match'); return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }
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
      {/* Background glow */}
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
        {/* Top accent */}
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

        {/* Tab switcher */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.04)',
          borderRadius: 10, padding: 3, marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
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

        <form onSubmit={handleSubmit}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            required placeholder="Email address" style={inputStyle}
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            required placeholder="Password" style={inputStyle}
          />
          <AnimatePresence>
            {mode === 'signup' && (
              <motion.input
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
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

          <motion.button
            type="submit" disabled={loading}
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

        {/* Skip */}
        <button
          onClick={onSkip}
          style={{
            width: '100%', padding: '9px', borderRadius: 10,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(241,245,249,0.35)', cursor: 'pointer',
            fontSize: 12, fontFamily: 'inherit',
          }}
        >
          Continue without account (use own API key)
        </button>
      </motion.div>
    </motion.div>
  );
}
