import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COUNTRIES = [
  { code: '+1',   iso: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: '+1',   iso: 'CA', name: 'Canada',          flag: '🇨🇦' },
  { code: '+44',  iso: 'GB', name: 'United Kingdom',  flag: '🇬🇧' },
  { code: '+91',  iso: 'IN', name: 'India',           flag: '🇮🇳' },
  { code: '+61',  iso: 'AU', name: 'Australia',       flag: '🇦🇺' },
  { code: '+49',  iso: 'DE', name: 'Germany',         flag: '🇩🇪' },
  { code: '+33',  iso: 'FR', name: 'France',          flag: '🇫🇷' },
  { code: '+81',  iso: 'JP', name: 'Japan',           flag: '🇯🇵' },
  { code: '+86',  iso: 'CN', name: 'China',           flag: '🇨🇳' },
  { code: '+55',  iso: 'BR', name: 'Brazil',          flag: '🇧🇷' },
  { code: '+7',   iso: 'RU', name: 'Russia',          flag: '🇷🇺' },
  { code: '+82',  iso: 'KR', name: 'South Korea',     flag: '🇰🇷' },
  { code: '+39',  iso: 'IT', name: 'Italy',           flag: '🇮🇹' },
  { code: '+34',  iso: 'ES', name: 'Spain',           flag: '🇪🇸' },
  { code: '+65',  iso: 'SG', name: 'Singapore',       flag: '🇸🇬' },
  { code: '+971', iso: 'AE', name: 'UAE',             flag: '🇦🇪' },
  { code: '+966', iso: 'SA', name: 'Saudi Arabia',    flag: '🇸🇦' },
  { code: '+60',  iso: 'MY', name: 'Malaysia',        flag: '🇲🇾' },
  { code: '+62',  iso: 'ID', name: 'Indonesia',       flag: '🇮🇩' },
  { code: '+880', iso: 'BD', name: 'Bangladesh',      flag: '🇧🇩' },
  { code: '+92',  iso: 'PK', name: 'Pakistan',        flag: '🇵🇰' },
  { code: '+94',  iso: 'LK', name: 'Sri Lanka',       flag: '🇱🇰' },
  { code: '+977', iso: 'NP', name: 'Nepal',           flag: '🇳🇵' },
  { code: '+52',  iso: 'MX', name: 'Mexico',          flag: '🇲🇽' },
  { code: '+27',  iso: 'ZA', name: 'South Africa',    flag: '🇿🇦' },
  { code: '+234', iso: 'NG', name: 'Nigeria',         flag: '🇳🇬' },
  { code: '+64',  iso: 'NZ', name: 'New Zealand',     flag: '🇳🇿' },
];

export default function PhoneInput({ value, onChange, placeholder = '9876543210' }) {
  const [selected, setSelected] = useState(COUNTRIES.find(c => c.iso === 'IN') || COUNTRIES[0]);
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNumber = (e) => {
    const n = e.target.value.replace(/\D/g, '');
    setNumber(n);
    onChange(`${selected.code}${n}`);
  };

  const selectCountry = (c) => {
    setSelected(c); onChange(`${c.code}${number}`);
    setOpen(false); setSearch('');
  };

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.includes(search)
  );

  return (
    <div style={{ position: 'relative', marginBottom: 10 }} ref={dropRef}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 10px', borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: `1px solid ${open ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`, color: '#f1f5f9', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
        >
          <span style={{ fontSize: 16 }}>{selected.flag}</span>
          <span style={{ fontWeight: 600 }}>{selected.code}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ fontSize: 8, opacity: 0.5 }}>▼</motion.span>
        </button>
        <input type="tel" value={number} onChange={handleNumber} placeholder={placeholder}
          style={{ flex: 1, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.15 }}
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', zIndex: 9999, background: 'rgba(15,15,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', overflow: 'hidden' }}
          >
            <div style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country..." autoFocus
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: 11, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {filtered.map(c => (
                <motion.button key={`${c.iso}-${c.code}`} type="button" onClick={() => selectCountry(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: selected.iso === c.iso ? 'rgba(124,58,237,0.15)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <span style={{ fontSize: 16 }}>{c.flag}</span>
                  <span style={{ fontSize: 12, color: '#f1f5f9', flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', fontWeight: 600 }}>{c.code}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
