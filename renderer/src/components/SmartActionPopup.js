import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatComplete } from '../utils/aiProvider';

const ACTIONS = [
  { id: 'explain',  icon: '💡', label: 'Explain' },
  { id: 'fix',      icon: '🔧', label: 'Fix' },
  { id: 'optimize', icon: '⚡', label: 'Optimize' },
];

export default function SmartActionPopup({ selectedText, position, aiSettings, apiKey, onClose, onApply }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const runAction = useCallback(async (actionId) => {
    if (!selectedText || !apiKey) return;
    setActiveAction(actionId);
    setLoading(true);
    setResult(null);

    const prompts = {
      explain:  `Explain this code snippet clearly and concisely in 2-4 sentences:\n\n\`\`\`\n${selectedText}\n\`\`\``,
      fix:      `Find and fix any bugs or issues in this code. Return ONLY the corrected code, no explanation:\n\n\`\`\`\n${selectedText}\n\`\`\``,
      optimize: `Optimize this code for performance and readability. Return ONLY the improved code, no explanation:\n\n\`\`\`\n${selectedText}\n\`\`\``,
    };

    try {
      const reply = await chatComplete({
        provider:  aiSettings?.provider,
        apiKey:    aiSettings?.openaiKey,
        model:     aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          { role: 'system', content: 'You are a concise code assistant. Be brief and precise.' },
          { role: 'user',   content: prompts[actionId] },
        ],
        maxTokens: 600,
        temperature: 0.2,
      });
      setResult({ action: actionId, text: reply });
    } catch (err) {
      setResult({ action: actionId, text: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [selectedText, apiKey, aiSettings]);

  if (!selectedText || !position) return null;

  // Keep popup inside viewport
  const style = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 320),
    top: position.y - 8,
    zIndex: 5000,
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        className="smart-popup"
        style={style}
        initial={{ opacity: 0, scale: 0.88, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {/* Action buttons */}
        {!result && !loading && (
          <div className="smart-popup-actions">
            <span className="smart-popup-label">
              {selectedText.length > 30 ? selectedText.slice(0, 30) + '…' : selectedText}
            </span>
            <div className="smart-popup-btns">
              {ACTIONS.map(a => (
                <motion.button
                  key={a.id}
                  className="smart-popup-btn"
                  onClick={() => runAction(a.id)}
                  whileHover={{ scale: 1.08, background: 'rgba(0,122,204,0.2)' }}
                  whileTap={{ scale: 0.92 }}
                  title={a.label}
                >
                  {a.icon} {a.label}
                </motion.button>
              ))}
              <button className="smart-popup-close" onClick={onClose}>✕</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="smart-popup-loading">
            <span className="spinner" style={{ width: 12, height: 12, borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {activeAction === 'explain' ? 'Explaining...' : activeAction === 'fix' ? 'Fixing...' : 'Optimizing...'}
            </span>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="smart-popup-result">
            <div className="smart-popup-result-header">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
                {result.action === 'explain' ? '💡 Explanation' : result.action === 'fix' ? '🔧 Fixed' : '⚡ Optimized'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {result.action !== 'explain' && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => { onApply?.(result.text); onClose(); }}
                  >
                    Apply
                  </button>
                )}
                <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setResult(null)}>↩</button>
                <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={onClose}>✕</button>
              </div>
            </div>
            <div className="smart-popup-result-body">{result.text}</div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
