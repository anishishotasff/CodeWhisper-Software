import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PROVIDERS, saveAISettings, loadAISettings } from '../utils/aiProvider';

const STEPS = [
  {
    id: 'welcome',
    icon: '🪄',
    title: 'Welcome to CodeWhisper',
    subtitle: 'Your AI-powered coding assistant',
  },
  {
    id: 'features',
    icon: '✨',
    title: 'What can CodeWhisper do?',
    subtitle: 'Everything you need to understand any codebase',
  },
  {
    id: 'ai',
    icon: '🤖',
    title: 'Set up your AI',
    subtitle: 'Choose how you want to power the AI features',
  },
  {
    id: 'ready',
    icon: '🚀',
    title: "You're all set!",
    subtitle: 'Start exploring your first project',
  },
];

const FEATURES = [
  { icon: '📂', title: 'Open any project',     desc: 'Browse files like VS Code with a smart file explorer' },
  { icon: '✏️', title: 'Edit code',             desc: 'Built-in editor with syntax highlighting and auto-save' },
  { icon: '👁',  title: 'Live Preview',          desc: 'Real-time rendering for HTML, CSS, and Markdown' },
  { icon: '🤖', title: 'AI Chat',               desc: 'Ask questions about your code in plain English' },
  { icon: '🔧', title: 'Auto-fix errors',       desc: 'AI detects and fixes bugs automatically' },
  { icon: '🗺',  title: 'Project Map',           desc: 'Visual dependency graph of your entire codebase' },
  { icon: '🐛', title: 'Bug Risk Detector',     desc: 'Static + AI-powered code analysis' },
  { icon: '🔒', title: 'Local / Private Mode',  desc: 'Run AI 100% offline with Ollama — no data sent anywhere' },
];

export default function WelcomeScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [aiMode, setAiMode] = useState('openai'); // 'openai' | 'ollama' | 'skip'
  const [apiKey, setApiKey] = useState('');
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  const isLast  = step === STEPS.length - 1;
  const isFirst = step === 0;

  const go = (delta) => {
    setDirection(delta);
    setStep(s => s + delta);
  };

  const handleFinish = () => {
    // Save AI settings
    const current = loadAISettings();
    if (aiMode === 'openai' && apiKey.trim()) {
      saveAISettings({ ...current, provider: PROVIDERS.OPENAI, openaiKey: apiKey.trim() });
      localStorage.setItem('openai_key', apiKey.trim());
    } else if (aiMode === 'ollama') {
      saveAISettings({ ...current, provider: PROVIDERS.OLLAMA });
    }
    // Mark as seen
    localStorage.setItem('cw_welcomed', '1');
    onComplete();
  };

  const variants = {
    enter:  (d) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit:   (d) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <div className="welcome-overlay">
      <motion.div
        className="welcome-modal"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Progress dots */}
        <div className="welcome-dots">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className={`welcome-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
              animate={{ scale: i === step ? 1.3 : 1 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="welcome-content">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="welcome-step"
            >
              {/* Step 0 — Welcome */}
              {step === 0 && (
                <div className="welcome-hero">
                  <motion.div
                    className="welcome-logo"
                    animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                  >
                    🪄
                  </motion.div>
                  <h1 className="welcome-title">Welcome to CodeWhisper</h1>
                  <p className="welcome-subtitle">
                    Your AI-powered coding assistant that helps you understand,<br />
                    explore, and improve any codebase — instantly.
                  </p>
                  <div className="welcome-badges">
                    <span className="welcome-badge">🖥 Windows</span>
                    <span className="welcome-badge">🍎 macOS</span>
                    <span className="welcome-badge">🐧 Linux</span>
                    <span className="welcome-badge">🔒 Privacy First</span>
                  </div>
                </div>
              )}

              {/* Step 1 — Features */}
              {step === 1 && (
                <div>
                  <h2 className="welcome-step-title">What can CodeWhisper do?</h2>
                  <div className="welcome-features">
                    {FEATURES.map((f, i) => (
                      <motion.div
                        key={f.title}
                        className="welcome-feature"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                      >
                        <span className="welcome-feature-icon">{f.icon}</span>
                        <div>
                          <div className="welcome-feature-title">{f.title}</div>
                          <div className="welcome-feature-desc">{f.desc}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — AI Setup */}
              {step === 2 && (
                <div>
                  <h2 className="welcome-step-title">Set up your AI</h2>
                  <p className="welcome-step-sub">You can change this anytime in AI Settings</p>

                  <div className="welcome-ai-options">
                    {/* OpenAI */}
                    <motion.div
                      className={`welcome-ai-card ${aiMode === 'openai' ? 'selected' : ''}`}
                      onClick={() => setAiMode('openai')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="welcome-ai-card-header">
                        <span style={{ fontSize: 24 }}>☁️</span>
                        <div>
                          <div className="welcome-ai-name">OpenAI (Cloud)</div>
                          <div className="welcome-ai-desc">GPT-4o-mini · Fast · Best quality</div>
                        </div>
                        {aiMode === 'openai' && <span className="welcome-ai-check">✓</span>}
                      </div>
                      <AnimatePresence>
                        {aiMode === 'openai' && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <input
                              className="welcome-key-input"
                              type="password"
                              placeholder="Paste your OpenAI API key (sk-...)"
                              value={apiKey}
                              onChange={e => setApiKey(e.target.value)}
                              autoFocus
                            />
                            <div className="welcome-key-hint">
                              Get your key at{' '}
                              <span style={{ color: 'var(--accent)' }}>platform.openai.com</span>
                              {' '}· You can add it later too
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Ollama */}
                    <motion.div
                      className={`welcome-ai-card ${aiMode === 'ollama' ? 'selected' : ''}`}
                      onClick={() => setAiMode('ollama')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="welcome-ai-card-header">
                        <span style={{ fontSize: 24 }}>🔒</span>
                        <div>
                          <div className="welcome-ai-name">Local AI (Ollama)</div>
                          <div className="welcome-ai-desc">100% offline · Free · Private</div>
                        </div>
                        <span className="welcome-privacy-tag">PRIVATE</span>
                        {aiMode === 'ollama' && <span className="welcome-ai-check">✓</span>}
                      </div>
                      <AnimatePresence>
                        {aiMode === 'ollama' && (
                          <motion.div
                            className="welcome-ollama-steps"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="welcome-ollama-step">
                              <span className="welcome-ollama-num">1</span>
                              <span>Install Ollama from <span style={{ color: 'var(--accent)' }}>ollama.com</span></span>
                            </div>
                            <div className="welcome-ollama-step">
                              <span className="welcome-ollama-num">2</span>
                              <code className="welcome-code">ollama serve</code>
                            </div>
                            <div className="welcome-ollama-step">
                              <span className="welcome-ollama-num">3</span>
                              <code className="welcome-code">ollama pull codellama</code>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Skip */}
                    <motion.div
                      className={`welcome-ai-card skip ${aiMode === 'skip' ? 'selected' : ''}`}
                      onClick={() => setAiMode('skip')}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="welcome-ai-card-header">
                        <span style={{ fontSize: 20 }}>⏭</span>
                        <div>
                          <div className="welcome-ai-name">Skip for now</div>
                          <div className="welcome-ai-desc">Use file explorer and editor without AI</div>
                        </div>
                        {aiMode === 'skip' && <span className="welcome-ai-check">✓</span>}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Step 3 — Ready */}
              {step === 3 && (
                <div className="welcome-ready">
                  <motion.div
                    className="welcome-ready-icon"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                  >
                    🚀
                  </motion.div>
                  <h2 className="welcome-title" style={{ marginTop: 16 }}>You're all set!</h2>
                  <p className="welcome-subtitle">Here's how to get started:</p>

                  <div className="welcome-quickstart">
                    {[
                      { num: '1', text: 'Click "📂 Open Project" to load any code folder' },
                      { num: '2', text: 'Click "🔍 Analyze" to understand the project structure' },
                      { num: '3', text: 'Ask the AI chat anything about your code' },
                      { num: '4', text: 'Click "🗺 Map" to see a visual dependency graph' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        className="welcome-quickstart-item"
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.08, duration: 0.2 }}
                      >
                        <span className="welcome-quickstart-num">{item.num}</span>
                        <span>{item.text}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="welcome-tip">
                    💡 Tip: Press <kbd>Ctrl+S</kbd> to save files in the editor
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div className="welcome-footer">
          {!isFirst ? (
            <motion.button
              className="btn btn-secondary"
              onClick={() => go(-1)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
            >
              ← Back
            </motion.button>
          ) : (
            <div />
          )}

          <motion.button
            className="btn btn-primary welcome-next-btn"
            onClick={isLast ? handleFinish : () => go(1)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
          >
            {isLast ? '🚀 Start using CodeWhisper' : 'Next →'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
