import React from 'react';
import { motion } from 'framer-motion';
import { loadCredits, getResetDateFormatted, CREDIT_COSTS } from '../utils/creditsManager';
import { getCurrentTheme, THEMES } from '../utils/themeManager';

export default function ProfilePanel({ onClose, onLogout, onOpenThemes, onOpenExtensions }) {
  const credits = loadCredits();
  const pct = Math.round((credits.credits / credits.maxCredits) * 100);
  const barColor = pct > 50 ? 'var(--success)' : pct > 20 ? 'var(--warning)' : 'var(--error)';
  const isPremium = credits.plan === 'premium';
  const currentTheme = THEMES[getCurrentTheme()];
  const avatar = credits.email ? credits.email[0].toUpperCase() : '?';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300, zIndex: 8000,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          👤 Profile
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 18, padding: 4,
        }}>✕</button>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Avatar + email */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px', borderRadius: 12,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: `linear-gradient(135deg, var(--accent), var(--success))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#fff',
            flexShrink: 0,
          }}>
            {avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {credits.email || 'Guest'}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
              padding: '2px 8px', borderRadius: 100,
              background: isPremium ? 'rgba(168,85,247,0.15)' : 'rgba(6,182,212,0.1)',
              border: `1px solid ${isPremium ? 'rgba(168,85,247,0.3)' : 'rgba(6,182,212,0.25)'}`,
              fontSize: 10, fontWeight: 700,
              color: isPremium ? '#a855f7' : '#06b6d4',
            }}>
              {isPremium ? '⭐ PREMIUM' : 'FREE'}
            </div>
          </div>
        </div>

        {/* Credits */}
        <div style={{
          padding: '14px', borderRadius: 12,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Monthly Credits
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Resets {getResetDateFormatted()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>
              {credits.credits.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              / {credits.maxCredits.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 100, background: 'var(--bg-hover)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 100, background: barColor }}
            />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{pct}% remaining</div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { icon: '🎨', label: 'Color Theme', sub: currentTheme?.name || 'VS Code Dark', action: onOpenThemes },
            { icon: '🧩', label: 'Extensions', sub: 'Manage extensions', action: onOpenExtensions },
          ].map(item => (
            <motion.button
              key={item.label}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
                width: '100%', fontFamily: 'inherit',
              }}
              whileHover={{ background: 'var(--bg-hover)', borderColor: 'var(--accent)' }}
              whileTap={{ scale: 0.98 }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontSize: 12 }}>›</span>
            </motion.button>
          ))}
        </div>

        {/* Credit usage */}
        <div style={{
          padding: '12px', borderRadius: 10,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Credit Usage
          </div>
          {[
            { label: 'AI chat', cost: CREDIT_COSTS.CHAT, icon: '💬' },
            { label: 'Bug fix', cost: CREDIT_COSTS.BUG_FIX, icon: '🔧' },
            { label: 'Code rewrite', cost: CREDIT_COSTS.REWRITE, icon: '✨' },
            { label: 'Project build', cost: CREDIT_COSTS.ANALYZE, icon: '🏗' },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {item.icon} {item.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                background: 'rgba(0,122,204,0.1)',
                padding: '1px 8px', borderRadius: 100,
              }}>
                {item.cost} cr
              </span>
            </div>
          ))}
        </div>

        {/* Sign out */}
        {credits.email && (
          <motion.button
            onClick={() => { onLogout?.(); onClose(); }}
            style={{
              width: '100%', padding: '10px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
            whileHover={{ background: 'rgba(239,68,68,0.15)' }}
            whileTap={{ scale: 0.98 }}
          >
            Sign Out
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
