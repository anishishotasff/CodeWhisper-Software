import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatComplete } from '../utils/aiProvider';

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'flow',    icon: '🔀', label: 'Flow' },
  { id: 'impact',  icon: '💥', label: 'Impact' },
  { id: 'improve', icon: '✨', label: 'Improve' },
  { id: 'quality', icon: '📊', label: 'Quality' },
  { id: 'search',  icon: '🔍', label: 'Search' },
];

// ── Explanation level ─────────────────────────────────────────────────────────
const LEVELS = [
  { id: 'beginner',      label: '🟢 Beginner',      desc: 'Simple language, no jargon' },
  { id: 'intermediate',  label: '🟡 Intermediate',   desc: 'Assumes basic coding knowledge' },
  { id: 'advanced',      label: '🔴 Advanced',       desc: 'Technical depth, patterns, trade-offs' },
];

// ── Shared AI call helper ─────────────────────────────────────────────────────
async function ask(aiSettings, messages, maxTokens = 1200) {
  return chatComplete({
    provider:  aiSettings?.provider,
    apiKey:    aiSettings?.openaiKey,
    model:     aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
    ollamaUrl: aiSettings?.ollamaUrl,
    messages,
    maxTokens,
    temperature: 0.3,
  });
}

// ── Quality score calculator (static, no AI) ─────────────────────────────────
function calcQuality(code, ext) {
  if (!code) return null;
  const lines = code.split('\n');
  const total = lines.length;

  // Complexity: long functions, deep nesting
  const deepNest   = lines.filter(l => (l.match(/^\s+/)?.[0]?.length || 0) > 24).length;
  const longFns    = (code.match(/function\s+\w+[^{]*\{[\s\S]{500,}?\}/g) || []).length;
  const complexity = Math.max(0, 100 - deepNest * 3 - longFns * 8);

  // Cleanliness: comments, naming, console.logs
  const comments   = lines.filter(l => /^\s*(\/\/|#|\/\*)/.test(l)).length;
  const consoleLogs = (code.match(/console\.(log|warn|error)/g) || []).length;
  const todoCount  = (code.match(/\b(TODO|FIXME|HACK)\b/gi) || []).length;
  const cleanliness = Math.max(0, Math.min(100,
    60 + (comments / Math.max(total, 1)) * 80 - consoleLogs * 5 - todoCount * 4
  ));

  // Structure: file length, function count
  const fnCount    = (code.match(/\b(function|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*\{)/g) || []).length;
  const structure  = Math.max(0, Math.min(100,
    total < 50 ? 95 : total < 200 ? 85 : total < 500 ? 70 : total < 1000 ? 55 : 40
  ));

  const overall = Math.round((complexity * 0.35 + cleanliness * 0.35 + structure * 0.3));

  return {
    overall,
    complexity: Math.round(complexity),
    cleanliness: Math.round(cleanliness),
    structure: Math.round(structure),
    lines: total,
    functions: fnCount,
    todos: todoCount,
    consoleLogs,
    grade: overall >= 85 ? 'A' : overall >= 70 ? 'B' : overall >= 55 ? 'C' : overall >= 40 ? 'D' : 'F',
    gradeColor: overall >= 85 ? 'var(--success)' : overall >= 70 ? '#4ec9b0' : overall >= 55 ? 'var(--warning)' : overall >= 40 ? '#e07b39' : 'var(--error)',
  };
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: color, borderRadius: 3 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────
function ResultBox({ content, onClear }) {
  return (
    <motion.div
      className="intel-result"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="intel-result-header">
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result</span>
        <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={onClear}>✕</button>
      </div>
      <div className="intel-result-body">{content}</div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IntelligencePanel({ selectedFile, content, projectPath, allFiles, aiSettings, apiKey, onClose }) {
  const [activeTab, setActiveTab]   = useState('flow');
  const [level, setLevel]           = useState('intermediate');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);

  // Flow
  const [flowResult, setFlowResult] = useState(null);

  // Impact
  const [impactResult, setImpactResult] = useState(null);

  // Improve
  const [improveResult, setImproveResult] = useState(null);
  const [showBefore, setShowBefore] = useState(false);

  // Quality
  const quality = content ? calcQuality(content, selectedFile?.ext) : null;

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const run = useCallback(async (tabId) => {
    if (!content || !selectedFile || !apiKey) return;
    setLoading(true);
    setError(null);

    const levelInstructions = {
      beginner:     'Explain in very simple terms. Avoid jargon. Use analogies.',
      intermediate: 'Assume basic programming knowledge. Be clear and concise.',
      advanced:     'Use technical depth. Mention patterns, trade-offs, and edge cases.',
    };
    const levelNote = `Explanation level: ${level}. ${levelInstructions[level]}`;

    try {
      let reply = '';

      if (tabId === 'flow') {
        reply = await ask(aiSettings, [{
          role: 'system',
          content: `You are a code flow analyst. ${levelNote}
Analyze the code and explain the execution flow step by step.
Format as numbered steps. Be specific about function calls, data transformations, and control flow.
End with a one-line summary of what the code does overall.`,
        }, {
          role: 'user',
          content: `File: ${selectedFile.name}\n\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``,
        }], 1200);
        setFlowResult(reply);

      } else if (tabId === 'impact') {
        const fileList = allFiles?.slice(0, 30).map(f => f.name).join(', ') || 'unknown';
        reply = await ask(aiSettings, [{
          role: 'system',
          content: `You are a dependency impact analyst. ${levelNote}
Analyze what would break or be affected if this file/its main exports were modified or deleted.
List: 1) Direct dependencies, 2) Likely affected files, 3) Risk level (Low/Medium/High), 4) Recommended precautions.
Be specific and practical.`,
        }, {
          role: 'user',
          content: `File: ${selectedFile.name}\nOther files in project: ${fileList}\n\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\``,
        }], 1000);
        setImpactResult(reply);

      } else if (tabId === 'improve') {
        reply = await ask(aiSettings, [{
          role: 'system',
          content: `You are a senior code reviewer. ${levelNote}
Rewrite the provided code to be cleaner, more efficient, and follow best practices.
Return ONLY valid JSON: {"improved": "<complete rewritten code>", "changes": ["<change 1>", "<change 2>", ...]}
Keep the same functionality. Improve: naming, structure, performance, readability.`,
        }, {
          role: 'user',
          content: `File: ${selectedFile.name}\n\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\``,
        }], 3000);
        try {
          const parsed = JSON.parse(reply);
          setImproveResult(parsed);
        } catch {
          setImproveResult({ improved: reply, changes: [] });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [content, selectedFile, apiKey, aiSettings, level, allFiles]);

  // Semantic search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !apiKey || !allFiles?.length) return;
    setLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const fileList = allFiles.slice(0, 40).map(f => `${f.name} (${f.path})`).join('\n');
      const reply = await ask(aiSettings, [{
        role: 'system',
        content: `You are a semantic code search engine.
Given a natural language query and a list of files, identify which files most likely contain the relevant logic.
Return ONLY valid JSON: {"results": [{"file": "<filename>", "path": "<path>", "reason": "<why this file>", "confidence": "high|medium|low"}]}
Max 5 results. Order by relevance.`,
      }, {
        role: 'user',
        content: `Query: "${searchQuery}"\n\nProject files:\n${fileList}`,
      }], 600);

      try {
        const parsed = JSON.parse(reply);
        setSearchResults(parsed.results || []);
      } catch {
        setSearchResults([{ file: 'Parse error', path: '', reason: reply, confidence: 'low' }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, apiKey, aiSettings, allFiles]);

  const CONFIDENCE_COLOR = { high: 'var(--success)', medium: 'var(--warning)', low: 'var(--text-muted)' };

  return (
    <div className="intel-panel">
      {/* Header */}
      <div className="intel-header">
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          🧠 Intelligence
        </span>
        {selectedFile && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFile.name}
          </span>
        )}
        <button className="btn btn-icon" onClick={onClose}>✕</button>
      </div>

      {/* Level selector */}
      <div className="intel-level-bar">
        {LEVELS.map(l => (
          <button
            key={l.id}
            className={`intel-level-btn ${level === l.id ? 'active' : ''}`}
            onClick={() => setLevel(l.id)}
            title={l.desc}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="intel-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`intel-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="intel-body">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── FLOW ── */}
            {activeTab === 'flow' && (
              <div>
                <p className="intel-desc">Step-by-step execution flow of this file.</p>
                <motion.button
                  className="btn btn-primary intel-run-btn"
                  onClick={() => run('flow')}
                  disabled={loading || !apiKey || !content}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? <><span className="spinner" /> Analyzing...</> : '🔀 Explain Flow'}
                </motion.button>
                {flowResult && (
                  <ResultBox content={flowResult} onClear={() => setFlowResult(null)} />
                )}
              </div>
            )}

            {/* ── IMPACT ── */}
            {activeTab === 'impact' && (
              <div>
                <p className="intel-desc">What breaks if this file is modified or deleted?</p>
                <motion.button
                  className="btn btn-primary intel-run-btn"
                  style={{ background: '#e07b39' }}
                  onClick={() => run('impact')}
                  disabled={loading || !apiKey || !content}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? <><span className="spinner" /> Analyzing...</> : '💥 Analyze Impact'}
                </motion.button>
                {impactResult && (
                  <ResultBox content={impactResult} onClear={() => setImpactResult(null)} />
                )}
              </div>
            )}

            {/* ── IMPROVE ── */}
            {activeTab === 'improve' && (
              <div>
                <p className="intel-desc">AI rewrites your code to be cleaner and more efficient.</p>
                <motion.button
                  className="btn btn-primary intel-run-btn"
                  style={{ background: 'var(--success)', color: '#000' }}
                  onClick={() => run('improve')}
                  disabled={loading || !apiKey || !content}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? <><span className="spinner" style={{ borderTopColor: '#000' }} /> Rewriting...</> : '✨ Improve Code'}
                </motion.button>

                {improveResult && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {improveResult.changes?.length > 0 && (
                      <div className="intel-changes">
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)', marginBottom: 6 }}>
                          ✅ {improveResult.changes.length} improvements made:
                        </div>
                        {improveResult.changes.map((c, i) => (
                          <div key={i} className="intel-change-item">• {c}</div>
                        ))}
                      </div>
                    )}
                    <div className="intel-diff-toggle">
                      <button
                        className={`intel-diff-btn ${!showBefore ? 'active' : ''}`}
                        onClick={() => setShowBefore(false)}
                      >After ✨</button>
                      <button
                        className={`intel-diff-btn ${showBefore ? 'active' : ''}`}
                        onClick={() => setShowBefore(true)}
                      >Before</button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 10, padding: '2px 8px', marginLeft: 'auto' }}
                        onClick={async () => {
                          const r = await window.electronAPI.writeFile(selectedFile.path, improveResult.improved);
                          if (r.success) {
                            window.dispatchEvent(new CustomEvent('codewhisper:fileFixed', {
                              detail: { path: selectedFile.path, content: improveResult.improved }
                            }));
                            setImproveResult(null);
                          }
                        }}
                      >
                        💾 Apply
                      </button>
                      <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setImproveResult(null)}>✕</button>
                    </div>
                    <pre className="intel-code-preview">
                      {showBefore ? content?.slice(0, 2000) : improveResult.improved?.slice(0, 2000)}
                      {(showBefore ? content : improveResult.improved)?.length > 2000 && '\n... (truncated)'}
                    </pre>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── QUALITY ── */}
            {activeTab === 'quality' && (
              <div>
                {!quality ? (
                  <p className="intel-desc">Open a file to see its quality score.</p>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    {/* Grade circle */}
                    <div className="intel-grade-row">
                      <div className="intel-grade-circle" style={{ borderColor: quality.gradeColor, color: quality.gradeColor }}>
                        {quality.grade}
                      </div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: quality.gradeColor }}>{quality.overall}/100</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Quality Score</div>
                      </div>
                    </div>

                    <ScoreBar label="Complexity"  value={quality.complexity}  color="#3178c6" />
                    <ScoreBar label="Cleanliness" value={quality.cleanliness} color="var(--success)" />
                    <ScoreBar label="Structure"   value={quality.structure}   color="#dcdcaa" />

                    <div className="intel-stats">
                      {[
                        { label: 'Lines',        value: quality.lines },
                        { label: 'Functions',    value: quality.functions },
                        { label: 'TODOs',        value: quality.todos,       warn: quality.todos > 0 },
                        { label: 'console.log',  value: quality.consoleLogs, warn: quality.consoleLogs > 0 },
                      ].map(s => (
                        <div key={s.label} className="intel-stat">
                          <div className="intel-stat-value" style={{ color: s.warn ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {s.value}
                          </div>
                          <div className="intel-stat-label">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── SEARCH ── */}
            {activeTab === 'search' && (
              <div>
                <p className="intel-desc">Search by meaning — "Where is the login logic?"</p>
                <div className="intel-search-row">
                  <input
                    className="intel-search-input"
                    placeholder='e.g. "Where is authentication handled?"'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <motion.button
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '5px 12px', flexShrink: 0 }}
                    onClick={handleSearch}
                    disabled={loading || !apiKey || !searchQuery.trim()}
                    whileTap={{ scale: 0.94 }}
                  >
                    {loading ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🔍'}
                  </motion.button>
                </div>

                {searchResults && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {searchResults.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No relevant files found.</div>
                    ) : (
                      searchResults.map((r, i) => (
                        <motion.div
                          key={i}
                          className="intel-search-result"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.file}</span>
                            <span style={{ fontSize: 9, color: CONFIDENCE_COLOR[r.confidence], background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 3 }}>
                              {r.confidence}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.reason}</div>
                          {r.path && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, fontFamily: 'monospace' }}>{r.path}</div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            className="intel-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ⚠️ {error}
            <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setError(null)}>✕</button>
          </motion.div>
        )}

        {/* No API key warning */}
        {!apiKey && activeTab !== 'quality' && (
          <div className="intel-no-key">
            🔑 Add an AI key in Settings to use this feature
          </div>
        )}
      </div>
    </div>
  );
}
