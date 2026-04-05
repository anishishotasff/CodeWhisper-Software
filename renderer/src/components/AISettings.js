import React, { useState, useEffect, useCallback } from 'react';
import {
  PROVIDERS, OLLAMA_MODELS, checkOllama,
  loadAISettings, saveAISettings,
} from '../utils/aiProvider';

export default function AISettings({ onClose, onSave }) {
  const [settings, setSettings] = useState(loadAISettings);
  const [ollamaStatus, setOllamaStatus] = useState(null); // null | 'checking' | { running, models }
  const [saved, setSaved] = useState(false);

  // Check Ollama status when switching to local mode or on mount
  const checkStatus = useCallback(async () => {
    setOllamaStatus('checking');
    const result = await checkOllama(settings.ollamaUrl);
    setOllamaStatus(result);
  }, [settings.ollamaUrl]);

  useEffect(() => {
    if (settings.provider === PROVIDERS.OLLAMA) checkStatus();
  }, [settings.provider]); // eslint-disable-line

  const update = (patch) => setSettings(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    saveAISettings(settings);
    onSave(settings);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  };

  const isOllama = settings.provider === PROVIDERS.OLLAMA;
  const ollamaRunning = ollamaStatus?.running;
  const installedModels = ollamaStatus?.models || [];

  return (
    <div className="settings-overlay">
      <div className="settings-modal">

        {/* Header */}
        <div className="settings-header">
          <span className="settings-title">⚙️ AI Settings</span>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Provider toggle */}
        <div className="settings-section">
          <div className="settings-label">AI Provider</div>
          <div className="provider-toggle">
            <button
              className={`provider-btn ${!isOllama ? 'active' : ''}`}
              onClick={() => update({ provider: PROVIDERS.OPENAI })}
            >
              <span className="provider-icon">☁️</span>
              <div>
                <div className="provider-name">OpenAI (Cloud)</div>
                <div className="provider-desc">GPT-4o-mini · Fast · Requires API key</div>
              </div>
            </button>

            <button
              className={`provider-btn ${isOllama ? 'active' : ''}`}
              onClick={() => update({ provider: PROVIDERS.OLLAMA })}
            >
              <span className="provider-icon">🔒</span>
              <div>
                <div className="provider-name">Ollama (Local / Private)</div>
                <div className="provider-desc">100% offline · No data sent · Free</div>
              </div>
              <span className="provider-privacy-badge">PRIVATE</span>
            </button>
          </div>
        </div>

        {/* OpenAI settings */}
        {!isOllama && (
          <div className="settings-section">
            <div className="settings-label">OpenAI API Key</div>
            <input
              className="settings-input"
              type="password"
              placeholder="sk-..."
              value={settings.openaiKey}
              onChange={e => update({ openaiKey: e.target.value })}
            />
            <div className="settings-hint">
              Get your key at <span style={{ color: 'var(--accent)' }}>platform.openai.com</span>
            </div>

            <div className="settings-label" style={{ marginTop: 12 }}>Model</div>
            <select
              className="settings-select"
              value={settings.openaiModel}
              onChange={e => update({ openaiModel: e.target.value })}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
              <option value="gpt-4o">gpt-4o (most capable)</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo (legacy)</option>
            </select>
          </div>
        )}

        {/* Ollama settings */}
        {isOllama && (
          <>
            {/* Privacy notice */}
            <div className="privacy-notice">
              <span style={{ fontSize: 18 }}>🔒</span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                  100% Private Mode
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  All AI processing happens on your machine. Your code, notes, and queries
                  never leave your computer. No API keys, no subscriptions, no tracking.
                </div>
              </div>
            </div>

            {/* Ollama URL */}
            <div className="settings-section">
              <div className="settings-label">Ollama Server URL</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="settings-input"
                  value={settings.ollamaUrl}
                  onChange={e => update({ ollamaUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={checkStatus}>
                  {ollamaStatus === 'checking' ? <><span className="spinner" style={{ width: 10, height: 10 }} /> Checking</> : '⟳ Check'}
                </button>
              </div>

              {/* Status indicator */}
              {ollamaStatus && ollamaStatus !== 'checking' && (
                <div className={`ollama-status ${ollamaRunning ? 'running' : 'stopped'}`}>
                  {ollamaRunning ? (
                    <>
                      <span>✅ Ollama is running</span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {installedModels.length} model{installedModels.length !== 1 ? 's' : ''} installed
                      </span>
                    </>
                  ) : (
                    <>
                      <span>❌ Ollama not detected</span>
                      <span style={{ color: 'var(--text-dim)' }}>See setup instructions below</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Model selection */}
            <div className="settings-section">
              <div className="settings-label">Model</div>

              {/* Installed models (from Ollama) */}
              {installedModels.length > 0 && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Installed on your machine:</div>
                  <div className="model-grid">
                    {installedModels.map(m => (
                      <button
                        key={m}
                        className={`model-btn ${settings.ollamaModel === m ? 'active' : ''}`}
                        onClick={() => update({ ollamaModel: m })}
                      >
                        <span className="model-name">{m}</span>
                        <span className="model-installed">✓ installed</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Recommended models */}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', margin: '10px 0 6px' }}>Recommended models:</div>
              <div className="model-grid">
                {OLLAMA_MODELS.map(m => {
                  const isInstalled = installedModels.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      className={`model-btn ${settings.ollamaModel === m.id ? 'active' : ''}`}
                      onClick={() => update({ ollamaModel: m.id })}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="model-name">{m.label}</span>
                        {isInstalled && <span className="model-installed">✓</span>}
                      </div>
                      <span className="model-desc">{m.desc}</span>
                      {!isInstalled && (
                        <span className="model-pull-hint">ollama pull {m.id}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setup instructions */}
            {!ollamaRunning && (
              <div className="settings-section">
                <div className="settings-label">Setup Instructions</div>
                <div className="setup-steps">
                  <div className="setup-step">
                    <span className="setup-num">1</span>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>Install Ollama</div>
                      <code className="setup-code">https://ollama.com/download</code>
                    </div>
                  </div>
                  <div className="setup-step">
                    <span className="setup-num">2</span>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>Start the server</div>
                      <code className="setup-code">ollama serve</code>
                    </div>
                  </div>
                  <div className="setup-step">
                    <span className="setup-num">3</span>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>Download a model</div>
                      <code className="setup-code">ollama pull codellama</code>
                    </div>
                  </div>
                  <div className="setup-step">
                    <span className="setup-num">4</span>
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: 3 }}>Click Check above</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CodeWhisper will detect it automatically</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saved}>
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
