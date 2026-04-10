import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WELCOME = [
  { type: 'system', text: '🖥  CodeWhisper Terminal — powered by your system shell' },
  { type: 'system', text: 'Type commands and press Enter. Type "clear" to clear.' },
  { type: 'system', text: '─────────────────────────────────────────────────────' },
];

export default function Terminal({ projectPath, onClose }) {
  const [lines, setLines] = useState(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = (text, type = 'output') => {
    setLines(prev => [...prev, { type, text }]);
  };

  const runCommand = async (cmd) => {
    if (!cmd.trim()) return;
    const trimmed = cmd.trim();

    if (trimmed === 'clear') { setLines(WELCOME); return; }

    addLine(`$ ${trimmed}`, 'command');
    setHistory(prev => [trimmed, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setRunning(true);

    try {
      if (window.electronAPI && window.electronAPI.runCommand) {
        const result = await window.electronAPI.runCommand(trimmed, projectPath);
        if (result.stdout) {
          result.stdout.split('\n').forEach(line => {
            if (line) addLine(line, 'output');
          });
        }
        if (result.stderr) {
          result.stderr.split('\n').forEach(line => {
            if (line) addLine(line, 'error');
          });
        }
        if (result.error) addLine(result.error, 'error');
      } else {
        addLine('Terminal requires the desktop app to run commands.', 'error');
      }
    } catch (err) {
      addLine(`Error: ${err.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      runCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx] || '');
    }
  };

  const lineColor = (type) => {
    if (type === 'command') return 'var(--accent)';
    if (type === 'error') return 'var(--error)';
    if (type === 'system') return 'var(--text-muted)';
    return 'var(--text-primary)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 280, zIndex: 7000,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>🖥</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Terminal</span>
          {projectPath && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {projectPath.split(/[/\\]/).pop()}
            </span>
          )}
          {running && (
            <span style={{ fontSize: 10, color: 'var(--accent)' }}>● running</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setLines(WELCOME)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 6px' }}
            title="Clear"
          >⊘</button>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
          >✕</button>
        </div>
      </div>

      {/* Output */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 12 }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} style={{ color: lineColor(line.type), lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
        flexShrink: 0,
      }}>
        <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 13, flexShrink: 0 }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          placeholder="Enter command..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, Consolas, monospace',
            fontSize: 12, caretColor: 'var(--accent)',
          }}
        />
        {running && <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)', width: 12, height: 12 }} />}
      </div>
    </motion.div>
  );
}
