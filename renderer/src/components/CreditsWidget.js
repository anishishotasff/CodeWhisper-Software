import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadCredits, getResetDateFormatted, CREDIT_COSTS } from '../utils/creditsManager';

export default function CreditsWidget({ onLogout, onRefresh }) {
  const [open, setOpen] = useState(false);
  const data = loadCredits();
  const pct = Math.round((data.credits / data.maxCredits) * 100);
  const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
  const isPremium = data.plan === 'premium';

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 8,
          background: pct < 20 ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.1)',
          border: `1px solid ${pct < 20 ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.25)'}`,
          color: pct < 20 ? '#f87171' : '#a855f7',
          cursor: 'pointer', fontSize: 11, fontWeight: 700,
          fontFamily: 'inherit',
        }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
      >
        <span>⚡</span>
        <span>{data.credits.toLocaleString()}</span>
        <span style={{ opacity: 0.5 }}>/ {data.maxCredits.toLocaleString()}</span>
        {isPremium && <span style={{ fontSize: 9, background: 'rgba(168,85,247,0.2)', padding: '1px 5px', borderRadius: 4 }}>PRO</span>}
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 280, zIndex: 999,
                background: 'rgba(15,15,26,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginBottom: 2 }}>
                      {data.email || 'Guest mode'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 24, fontWeight: 900, color: '#f1f5f9' }}>
                        {data.credits.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.35)' }}>
                        / {data.maxCredits.toLocaleString()} credits
                      </span>
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 100,
                    background: isPremium ? 'rgba(168,85,247,0.15)' : 'rgba(6,182,212,0.1)',
                    border: `1px solid ${isPremium ? 'rgba(168,85,247,0.3)' : 'rgba(6,182,212,0.25)'}`,
                    fontSize: 10, fontWeight: 700,
                    color: isPremium ? '#a855f7' : '#06b6d4',
                  }}>
                    {isPremium ? '⭐ PREMIUM' : 'FREE'}
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 100,
                      background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: 'rgba(241,245,249,0.3)' }}>{pct}% remaining</span>
                  <span style={{ fontSize: 10, color: 'rgba(241,245,249,0.3)' }}>Resets {getResetDateFormatted()}</span>
                </div>
              </div>

              {/* Credit costs */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(241,245,249,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Credit Usage
                </div>
                {[
                  { label: 'AI chat message', cost: CREDIT_COSTS.CHAT, icon: '💬' },
                  { label: 'Bug detection', cost: CREDIT_COSTS.BUG_SCAN, icon: '🐛' },
                  { label: 'Auto bug fix', cost: CREDIT_COSTS.BUG_FIX, icon: '🔧' },
                  { label: 'Code rewrite', cost: CREDIT_COSTS.REWRITE, icon: '✨' },
                  { label: 'Project analysis', cost: CREDIT_COSTS.ANALYZE, icon: '🔍' },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.55)', display: 'flex', gap: 6 }}>
                      <span>{item.icon}</span>{item.label}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#a855f7',
                      background: 'rgba(168,85,247,0.1)',
                      padding: '1px 8px', borderRadius: 100,
                      border: '1px solid rgba(168,85,247,0.2)',
                    }}>
                      {item.cost} cr
                    </span>
                  </div>
                ))}
              </div>

              {/* Low credits warning */}
              {pct < 20 && (
                <div style={{
                  padding: '10px 16px',
                  background: 'rgba(239,68,68,0.08)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11, color: '#f87171',
                }}>
                  ⚠️ Running low on credits. Upgrade for 1,000/month.
                </div>
              )}

              {/* Footer actions */}
              <div style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
                {!isPremium && (
                  <motion.a
                    href="https://codewhisper.vercel.app/#pricing"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1, textAlign: 'center', padding: '8px',
                      borderRadius: 8, textDecoration: 'none',
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                    }}
                    whileHover={{ scale: 1.02 }}
                  >
                    ⭐ Upgrade
                  </motion.a>
                )}
                {data.email && (
                  <motion.button
                    onClick={() => { setOpen(false); onLogout?.(); }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(241,245,249,0.5)', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'inherit',
                    }}
                    whileHover={{ color: '#f1f5f9' }}
                  >
                    Sign out
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
