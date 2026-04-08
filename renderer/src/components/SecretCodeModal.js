import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { saveCredits, loadCredits } from '../utils/creditsManager';

// Secret code → unlocks premium + uses the embedded API key
// The actual API key is read from env var (never hardcoded in source)
const SECRET_CODE = 'codeislikemusic';
const PREMIUM_API_KEY = process.env.REACT_APP_GEMINI_KEY || '';

export function isSecretUnlocked() {
  return localStorage.getItem('cw_secret_unlocked') === '1';
}

export function getSecretApiKey() {
  if (!isSecretUnlocked()) return null;
  return PREMIUM_API_KEY || null;
}

export default function SecretCodeModal({ onClose, onUnlock }) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | success | error
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim().toLowerCase() === SECRET_CODE) {
      // Unlock premium
      localStorage.setItem('cw_secret_unlocked', '1');

      // Upgrade credits to premium
      const current = loadCredits();
      saveCredits({
        ...current,
        plan: 'premium',
        maxCredits: 1000,
        credits: Math.max(current.credits, 1000),
      });

      setStatus('success');
      setTimeout(() => {
        onUnlock?.();
        onClose();
      }, 1800);
    } else {
      setStatus('error');
      setShake(true);
      setTimeout(() => { setShake(false); setStatus('idle'); setCode(''); }, 1200);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(10,10,15,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(16px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={shake
          ? { opacity: 1, scale: 1, y: 0, x: [0, -10, 10, -8, 8, 0] }
          : { opacity: 1, scale: 1, y: 0, x: 0 }
        }
        transition={{ duration: shake ? 0.4 : 0.25, ease: 'easeOut' }}
        style={{
          width: 360,
          background: 'rgba(15,15,26,0.98)',
          border: `1px solid ${status === 'success' ? 'rgba(16,185,129,0.4)' : status === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 20, padding: '36px 32px',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          transition: 'border-color 0.3s',
        }}
      >
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: status === 'success'
            ? 'linear-gradient(90deg, #10b981, #06b6d4)'
            : 'linear-gradient(90deg, #7c3aed, #06b6d4)',
          transition: 'background 0.3s',
        }} />

        {/* Icon + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <motion.div
            animate={status === 'success' ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.5 }}
            style={{ fontSize: 40, marginBottom: 10 }}
          >
            {status === 'success' ? '🎉' : '🔐'}
          </motion.div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            {status === 'success' ? 'Premium Unlocked!' : 'Secret Code'}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginTop: 6 }}>
            {status === 'success'
              ? 'Welcome to Premium — 1,000 credits activated'
              : 'Enter your secret code to unlock Premium'}
          </div>
        </div>

        {status !== 'success' && (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter secret code..."
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: status === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${status === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                color: '#f1f5f9', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', fontFamily: 'inherit',
                textAlign: 'center', letterSpacing: 2,
                marginBottom: 12,
                transition: 'border-color 0.2s, background 0.2s',
              }}
            />

            {status === 'error' && (
              <div style={{
                textAlign: 'center', fontSize: 12, color: '#f87171', marginBottom: 12,
              }}>
                ❌ Invalid code. Try again.
              </div>
            )}

            <motion.button
              type="submit"
              disabled={!code.trim()}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: code.trim()
                  ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
                  : 'rgba(255,255,255,0.05)',
                color: code.trim() ? '#fff' : 'rgba(241,245,249,0.3)',
                border: 'none', cursor: code.trim() ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                boxShadow: code.trim() ? '0 0 24px rgba(124,58,237,0.4)' : 'none',
              }}
              whileHover={code.trim() ? { scale: 1.02 } : {}}
              whileTap={code.trim() ? { scale: 0.98 } : {}}
            >
              Unlock Premium
            </motion.button>
          </form>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              textAlign: 'center', padding: '12px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 10,
              fontSize: 13, color: '#10b981', fontWeight: 600,
            }}
          >
            ⭐ 1,000 credits · AI key activated · Premium features unlocked
          </motion.div>
        )}

        {status !== 'success' && (
          <button
            onClick={onClose}
            style={{
              display: 'block', width: '100%', marginTop: 10,
              padding: '8px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: 'rgba(241,245,249,0.3)', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
