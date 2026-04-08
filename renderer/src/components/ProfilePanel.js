import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadCredits, getResetDateFormatted, CREDIT_COSTS } from '../utils/creditsManager';
import { getCurrentTheme, THEMES } from '../utils/themeManager';

// Circular progress ring
function CreditRing({ pct, color, size = 80 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  );
}

const SECTIONS = ['Overview', 'Credits', 'Settings', 'Shortcuts'];

export default function ProfilePanel({ onClose, onLogout, onOpenThemes, onOpenExtensions }) {
  const credits = loadCredits();
  const [section, setSection] = useState('Overview');
  const pct = Math.round((credits.credits / credits.maxCredits) * 100);
  const used = credits.maxCredits - credits.credits;
  const barColor = pct > 50 ? '#10b981' : pct > 20 ? '#f59e0b' : '#ef4444';
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
        width: 320, zIndex: 8000,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 0',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>👤 Profile</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, padding: 4,
          }}>✕</button>
        </div>

        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--success))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 900, color: '#fff',
            boxShadow: '0 0 16px rgba(0,122,204,0.3)',
          }}>
            {avatar}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {credits.email || 'Guest User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <div style={{
                padding: '1px 8px', borderRadius: 100,
                background: isPremium ? 'rgba(168,85,247,0.15)' : 'rgba(6,182,212,0.1)',
                border: `1px solid ${isPremium ? 'rgba(168,85,247,0.3)' : 'rgba(6,182,212,0.25)'}`,
                fontSize: 10, fontWeight: 700,
                color: isPremium ? '#a855f7' : '#06b6d4',
              }}>
                {isPremium ? '⭐ PREMIUM' : 'FREE'}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                Resets {getResetDateFormatted()}
              </span>
            </div>
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              style={{
                flex: 1, padding: '6px 4px', border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                background: 'transparent',
                color: section === s ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${section === s ? 'var(--accent)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{ padding: '16px' }}
          >

            {/* ── OVERVIEW ── */}
            {section === 'Overview' && (
              <>
                {/* Credit ring */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px', borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  marginBottom: 12,
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <CreditRing pct={pct} color={barColor} size={72} />
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {pct}%
                      </span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>left</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {credits.credits.toLocaleString()}
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                        {' '}/ {credits.maxCredits.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>credits remaining</div>
                    <div style={{ fontSize: 11, color: barColor, marginTop: 2 }}>
                      {used.toLocaleString()} used this month
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Plan', value: isPremium ? 'Premium' : 'Free', color: isPremium ? '#a855f7' : '#06b6d4' },
                    { label: 'Credits Used', value: used.toLocaleString(), color: 'var(--warning)' },
                    { label: 'Max Credits', value: credits.maxCredits.toLocaleString(), color: 'var(--text-primary)' },
                    { label: 'Resets', value: getResetDateFormatted(), color: 'var(--text-muted)' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                {[
                  { icon: '🎨', label: 'Color Theme', sub: currentTheme?.name, action: onOpenThemes },
                  { icon: '🧩', label: 'Extensions', sub: 'Manage extensions', action: onOpenExtensions },
                ].map(item => (
                  <motion.button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer', width: '100%', textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                    whileHover={{ background: 'var(--bg-hover)', borderColor: 'var(--accent)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                    <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>›</span>
                  </motion.button>
                ))}

                {credits.email && (
                  <motion.button
                    onClick={() => { onLogout?.(); onClose(); }}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 8, marginTop: 4,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    }}
                    whileHover={{ background: 'rgba(239,68,68,0.15)' }}
                  >
                    Sign Out
                  </motion.button>
                )}
              </>
            )}

            {/* ── CREDITS ── */}
            {section === 'Credits' && (
              <>
                {/* Big credit display */}
                <div style={{
                  textAlign: 'center', padding: '20px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <CreditRing pct={pct} color={barColor} size={100} />
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {credits.credits.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    of {credits.maxCredits.toLocaleString()} credits remaining
                  </div>
                  <div style={{ fontSize: 11, color: barColor, marginTop: 6 }}>
                    {pct}% left · {used.toLocaleString()} used
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                    Resets automatically on {getResetDateFormatted()}
                  </div>
                </div>

                {/* Credit bar */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 8, borderRadius: 100, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      style={{ height: '100%', borderRadius: 100, background: barColor }}
                    />
                  </div>
                </div>

                {/* Cost breakdown */}
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Credit Costs
                </div>
                {[
                  { icon: '💬', label: 'AI chat message', cost: CREDIT_COSTS.CHAT, canDo: Math.floor(credits.credits / CREDIT_COSTS.CHAT) },
                  { icon: '🐛', label: 'Bug detection', cost: CREDIT_COSTS.BUG_SCAN, canDo: Math.floor(credits.credits / CREDIT_COSTS.BUG_SCAN) },
                  { icon: '🔧', label: 'Auto bug fix', cost: CREDIT_COSTS.BUG_FIX, canDo: Math.floor(credits.credits / CREDIT_COSTS.BUG_FIX) },
                  { icon: '✨', label: 'Code rewrite', cost: CREDIT_COSTS.REWRITE, canDo: Math.floor(credits.credits / CREDIT_COSTS.REWRITE) },
                  { icon: '🔍', label: 'Project analysis', cost: CREDIT_COSTS.ANALYZE, canDo: Math.floor(credits.credits / CREDIT_COSTS.ANALYZE) },
                  { icon: '🏗', label: 'Build project', cost: CREDIT_COSTS.ANALYZE, canDo: Math.floor(credits.credits / CREDIT_COSTS.ANALYZE) },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
                      {item.icon} {item.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>~{item.canDo}x left</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                        background: 'rgba(0,122,204,0.1)',
                        padding: '1px 8px', borderRadius: 100,
                      }}>
                        {item.cost} cr
                      </span>
                    </div>
                  </div>
                ))}

                {!isPremium && (
                  <motion.a
                    href="https://codewhisper.vercel.app/#pricing"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block', textAlign: 'center', marginTop: 12,
                      padding: '10px', borderRadius: 10,
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      color: '#fff', textDecoration: 'none',
                      fontSize: 13, fontWeight: 700,
                      boxShadow: '0 0 20px rgba(124,58,237,0.3)',
                    }}
                    whileHover={{ scale: 1.02 }}
                  >
                    ⭐ Upgrade to 1,000 credits/month
                  </motion.a>
                )}
              </>
            )}

            {/* ── SETTINGS ── */}
            {section === 'Settings' && (
              <>
                {[
                  { icon: '🎨', label: 'Color Theme', sub: currentTheme?.name || 'VS Code Dark', action: onOpenThemes },
                  { icon: '🧩', label: 'Extensions', sub: 'Install & manage extensions', action: onOpenExtensions },
                  { icon: '🤖', label: 'AI Settings', sub: 'API keys, models, Ollama', action: null },
                  { icon: '📝', label: 'Notepad', sub: 'Smart notes linked to files', action: null },
                  { icon: '🗺', label: 'Project Map', sub: 'Visualize file relationships', action: null },
                ].map(item => (
                  <motion.button
                    key={item.label}
                    onClick={item.action}
                    disabled={!item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px', borderRadius: 10, marginBottom: 8,
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      cursor: item.action ? 'pointer' : 'default',
                      width: '100%', textAlign: 'left', fontFamily: 'inherit',
                      opacity: item.action ? 1 : 0.6,
                    }}
                    whileHover={item.action ? { background: 'var(--bg-hover)', borderColor: 'var(--accent)' } : {}}
                    whileTap={item.action ? { scale: 0.98 } : {}}
                  >
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
                    </div>
                    {item.action && <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>›</span>}
                  </motion.button>
                ))}

                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>App Version</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>CodeWhisper v1.0.2</div>
                </div>
              </>
            )}

            {/* ── SHORTCUTS ── */}
            {section === 'Shortcuts' && (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Keyboard shortcuts to work faster
                </div>
                {[
                  { keys: ['Ctrl', 'S'], label: 'Save file' },
                  { keys: ['Tab'], label: 'Indent code' },
                  { keys: ['Shift', 'Tab'], label: 'Unindent code' },
                  { keys: ['Enter'], label: 'Auto-indent new line' },
                  { keys: ['Ctrl', 'Enter'], label: 'Send chat message' },
                  { keys: ['Ctrl', 'Z'], label: 'Undo' },
                  { keys: ['Ctrl', 'C'], label: 'Copy code' },
                  { keys: ['Ctrl', 'A'], label: 'Select all' },
                  { keys: ['Esc'], label: 'Close panel / modal' },
                ].map(sc => (
                  <div key={sc.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sc.label}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {sc.keys.map(k => (
                        <kbd key={k} style={{
                          padding: '2px 6px', borderRadius: 4,
                          background: 'var(--bg-hover)',
                          border: '1px solid var(--border)',
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                        }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
