import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EXTENSIONS = [
  { id: 'prettier', name: 'Prettier', desc: 'Format code on save — JS, TS, CSS, JSON, Markdown', icon: '✨', category: 'Formatter', color: '#f7b93e' },
  { id: 'eslint', name: 'ESLint', desc: 'Real-time JavaScript/TypeScript linting with auto-fix', icon: '🔍', category: 'Linter', color: '#4b32c3' },
  { id: 'git-lens', name: 'GitLens', desc: 'See git blame, history, and changes inline in your code', icon: '🔀', category: 'Git', color: '#e8564a' },
  { id: 'todo-highlight', name: 'TODO Highlight', desc: 'Highlights TODO, FIXME, HACK comments in your code', icon: '📌', category: 'Productivity', color: '#ff9800' },
  { id: 'bracket-colorizer', name: 'Bracket Colorizer', desc: 'Color-matches brackets, parentheses, and braces', icon: '🎨', category: 'Visual', color: '#e91e63' },
  { id: 'indent-rainbow', name: 'Indent Rainbow', desc: 'Colorizes indentation levels for better readability', icon: '🌈', category: 'Visual', color: '#9c27b0' },
  { id: 'path-intellisense', name: 'Path Intellisense', desc: 'Autocompletes file paths as you type', icon: '📁', category: 'Intellisense', color: '#2196f3' },
  { id: 'code-spell', name: 'Code Spell Checker', desc: 'Catches spelling mistakes in code and comments', icon: '📝', category: 'Linter', color: '#00bcd4' },
  { id: 'auto-rename', name: 'Auto Rename Tag', desc: 'Automatically renames paired HTML/JSX tags', icon: '🏷', category: 'HTML', color: '#ff5722' },
  { id: 'live-share', name: 'Live Share', desc: 'Real-time collaborative editing with your team', icon: '👥', category: 'Collaboration', color: '#7c3aed' },
  { id: 'docker', name: 'Docker', desc: 'Manage Docker containers, images, and compose files', icon: '🐳', category: 'DevOps', color: '#0db7ed' },
  { id: 'rest-client', name: 'REST Client', desc: 'Send HTTP requests and view responses directly in the editor', icon: '🌐', category: 'API', color: '#4caf50' },
  { id: 'tailwind', name: 'Tailwind CSS IntelliSense', desc: 'Autocomplete, syntax highlighting for Tailwind CSS', icon: '💨', category: 'CSS', color: '#06b6d4' },
  { id: 'github-copilot', name: 'GitHub Copilot', desc: 'AI pair programmer that suggests code as you type', icon: '🤖', category: 'AI', color: '#6e40c9' },
  { id: 'error-lens', name: 'Error Lens', desc: 'Highlight errors and warnings inline in the editor', icon: '🚨', category: 'Linter', color: '#ef4444' },
  { id: 'material-icons', name: 'Material Icon Theme', desc: 'Beautiful file icons for your project explorer', icon: '🎭', category: 'Visual', color: '#ff6d00' },
  { id: 'peacock', name: 'Peacock', desc: 'Color your workspace to identify different projects', icon: '🦚', category: 'Visual', color: '#10b981' },
  { id: 'thunder-client', name: 'Thunder Client', desc: 'Lightweight REST API client built into the editor', icon: '⚡', category: 'API', color: '#f59e0b' },
  { id: 'git-graph', name: 'Git Graph', desc: 'View a Git graph of your repository with actions', icon: '📊', category: 'Git', color: '#3b82f6' },
  { id: 'wakatime', name: 'WakaTime', desc: 'Automatic time tracking for your coding activity', icon: '⏱', category: 'Productivity', color: '#a855f7' },
  { id: 'polacode', name: 'Polacode', desc: 'Take beautiful screenshots of your code', icon: '📸', category: 'Productivity', color: '#ec4899' },
  { id: 'settings-sync', name: 'Settings Sync', desc: 'Sync your settings, snippets, and extensions across machines', icon: '☁️', category: 'Productivity', color: '#64748b' },
  { id: 'remote-ssh', name: 'Remote SSH', desc: 'Open any folder on a remote machine using SSH', icon: '🔌', category: 'Remote', color: '#0ea5e9' },
  { id: 'jupyter', name: 'Jupyter', desc: 'Run Jupyter notebooks directly in the editor', icon: '📓', category: 'Data Science', color: '#f97316' },
];

const CATEGORIES = ['All', ...new Set(EXTENSIONS.map(e => e.category))];

export default function ExtensionsPanel({ onClose }) {
  const [installed, setInstalled] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cw_extensions') || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [installing, setInstalling] = useState(null);

  const toggle = (id) => {
    setInstalling(id);
    setTimeout(() => {
      setInstalled(prev => {
        const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
        localStorage.setItem('cw_extensions', JSON.stringify(next));
        return next;
      });
      setInstalling(null);
    }, 800);
  };

  const filtered = EXTENSIONS.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.desc.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380, zIndex: 8000,
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
            🧩 Extensions
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {installed.length} installed
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 18, padding: 4,
        }}>✕</button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search extensions..."
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
            boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px',
        overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '3px 10px', borderRadius: 100, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 500,
              whiteSpace: 'nowrap', fontFamily: 'inherit',
              background: category === cat ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: category === cat ? '#fff' : 'var(--text-muted)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Extension list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered.map(ext => {
          const isInstalled = installed.includes(ext.id);
          const isInstalling = installing === ext.id;
          return (
            <motion.div
              key={ext.id}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}
              whileHover={{ background: 'var(--bg-hover)' }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                background: `${ext.color}20`,
                border: `1px solid ${ext.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20,
              }}>
                {ext.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ext.name}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 100,
                    background: `${ext.color}20`, color: ext.color,
                    border: `1px solid ${ext.color}40`, fontWeight: 600,
                  }}>
                    {ext.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {ext.desc}
                </div>
              </div>

              {/* Install button */}
              <motion.button
                onClick={() => toggle(ext.id)}
                disabled={isInstalling}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  cursor: isInstalling ? 'not-allowed' : 'pointer',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  flexShrink: 0,
                  background: isInstalled ? 'rgba(239,68,68,0.1)' : `${ext.color}20`,
                  color: isInstalled ? '#f87171' : ext.color,
                  border: `1px solid ${isInstalled ? 'rgba(239,68,68,0.3)' : ext.color + '40'}`,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isInstalling ? '...' : isInstalled ? 'Remove' : 'Install'}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
