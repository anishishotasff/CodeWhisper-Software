import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CURRENT_VERSION = '1.0.2';
const RELEASES_API = 'https://api.github.com/repos/anishishotasff/CodeWhisper-Software/releases/latest';
const DOWNLOAD_URL = 'https://github.com/anishishotasff/CodeWhisper-Software/releases/latest';

function parseVersion(v) {
  return (v || '').replace(/^v/, '').split('.').map(Number);
}

function isNewer(latest, current) {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

export default function UpdateBanner() {
  const [update, setUpdate] = useState(null); // { version, url }
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check once on startup, skip if dismissed this session
    const key = `cw_update_dismissed`;
    if (sessionStorage.getItem(key)) return;

    const check = async () => {
      try {
        const res = await fetch(RELEASES_API, {
          headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const latest = data.tag_name || data.name || '';
        if (isNewer(latest, CURRENT_VERSION)) {
          setUpdate({ version: latest.replace(/^v/, ''), url: DOWNLOAD_URL });
        }
      } catch {
        // Silently fail — no internet or API limit
      }
    };

    // Delay 3s so it doesn't fire immediately on startup
    const t = setTimeout(check, 3000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('cw_update_dismissed', '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {update && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            zIndex: 99999,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.95), rgba(6,182,212,0.9))',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '10px 20px',
            boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
          }}
        >
          {/* Icon */}
          <span style={{ fontSize: 18 }}>🪄</span>

          {/* Message */}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
            CodeWhisper {update.version} is available — you're on {CURRENT_VERSION}
          </span>

          {/* Download button */}
          <motion.a
            href={update.url}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '5px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff', textDecoration: 'none',
              fontSize: 12, fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
            whileHover={{ background: 'rgba(255,255,255,0.3)', scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Download Update ↗
          </motion.a>

          {/* Dismiss */}
          <motion.button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              fontSize: 16, padding: '2px 6px',
              lineHeight: 1,
            }}
            whileHover={{ color: '#fff' }}
            title="Dismiss"
          >
            ✕
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
