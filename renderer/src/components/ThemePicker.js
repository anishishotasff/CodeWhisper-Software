import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { THEMES, applyTheme, getCurrentTheme } from '../utils/themeManager';

export default function ThemePicker({ onClose }) {
  const [current, setCurrent] = useState(getCurrentTheme());
  const [hovered, setHovered] = useState(null);

  const select = (id) => {
    applyTheme(id);
    setCurrent(id);
  };

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
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            🎨 Color Themes
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {Object.keys(THEMES).length} themes available
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 18, padding: 4,
        }}>✕</button>
      </div>

      {/* Theme list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {Object.entries(THEMES).map(([id, theme]) => {
          const isActive = current === id;
          const vars = theme.vars;
          return (
            <motion.div
              key={id}
              onClick={() => select(id)}
              onHoverStart={() => setHovered(id)}
              onHoverEnd={() => setHovered(null)}
              style={{
                padding: '12px 16px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: isActive ? 'rgba(var(--accent), 0.1)' : 'transparent',
                borderLeft: isActive ? `3px solid ${vars['--accent']}` : '3px solid transparent',
              }}
              whileHover={{ background: 'var(--bg-hover)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{theme.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: isActive ? vars['--accent'] : 'var(--text-primary)',
                  }}>
                    {theme.name}
                    {isActive && <span style={{ fontSize: 10, marginLeft: 6, color: vars['--accent'] }}>● Active</span>}
                  </div>
                </div>
              </div>

              {/* Color preview swatches */}
              <div style={{ display: 'flex', gap: 4, borderRadius: 6, overflow: 'hidden' }}>
                {[
                  vars['--bg-primary'],
                  vars['--bg-secondary'],
                  vars['--accent'],
                  vars['--text-primary'],
                  vars['--success'],
                  vars['--warning'],
                  vars['--error'],
                ].map((color, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1, height: 20,
                      background: color,
                      borderRadius: i === 0 ? '4px 0 0 4px' : i === 6 ? '0 4px 4px 0' : 0,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
