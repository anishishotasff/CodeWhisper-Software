import React, { useState, useEffect, useCallback, useRef } from 'react';
import { detectBugs, SEVERITY_COLOR, SEVERITY_BG, SEVERITY_ORDER } from '../utils/bugDetector';
import { chatComplete } from '../utils/aiProvider';

// Auto-fix triggers when critical/high issues are found and AI is available
const AUTO_FIX_THRESHOLD = 1; // min issues to trigger auto-fix

export default function BugRiskPanel({ selectedFile, content, apiKey, aiSettings, onClose, onContentFixed }) {
  const [issues, setIssues]           = useState(null);
  const [scanning, setScanning]       = useState(false);
  const [aiScanning, setAiScanning]   = useState(false);
  const [aiIssues, setAiIssues]       = useState(null);
  const [filter, setFilter]           = useState('all');
  const [expanded, setExpanded]       = useState(new Set());

  // Auto-fix state
  const [autoFixing, setAutoFixing]   = useState(false);
  const [autoFixResult, setAutoFixResult] = useState(null); // { fixed, explanation, appliedAt }
  const [autoFixError, setAutoFixError]   = useState(null);
  const [autoFixEnabled, setAutoFixEnabled] = useState(
    () => localStorage.getItem('cw_autofix') !== 'false'
  );

  const autoFixTimer = useRef(null);
  const lastFixedContent = useRef(null); // prevent re-fixing same content

  // ── Static scan on every file/content change ────────────────────────────────
  useEffect(() => {
    if (!content || !selectedFile) {
      setIssues(null); setAiIssues(null); setAutoFixResult(null);
      return;
    }
    setScanning(true);
    setAiIssues(null);

    const t = setTimeout(() => {
      try {
        const found = detectBugs(content, selectedFile.ext || '');
        setIssues(found);
      } catch {
        setIssues([]);
      }
      setScanning(false);
    }, 80);
    return () => clearTimeout(t);
  }, [content, selectedFile]);

  // ── Auto-fix: triggers 1.5s after scan completes if issues found ────────────
  useEffect(() => {
    clearTimeout(autoFixTimer.current);

    if (
      !autoFixEnabled ||
      !apiKey ||
      !issues ||
      !selectedFile ||
      !content ||
      content === lastFixedContent.current
    ) return;

    const criticalOrHigh = issues.filter(i => i.severity === 'critical' || i.severity === 'high');
    if (criticalOrHigh.length < AUTO_FIX_THRESHOLD) return;

    // Debounce — wait 1.5s after scan before auto-fixing
    autoFixTimer.current = setTimeout(() => {
      runAutoFix(content, selectedFile, issues);
    }, 1500);

    return () => clearTimeout(autoFixTimer.current);
  }, [issues, autoFixEnabled, apiKey, selectedFile]); // eslint-disable-line

  // ── Core auto-fix function ──────────────────────────────────────────────────
  const runAutoFix = useCallback(async (currentContent, file, detectedIssues) => {
    if (!apiKey || !file || !currentContent) return;
    setAutoFixing(true);
    setAutoFixResult(null);
    setAutoFixError(null);

    try {
      const lang = file.ext?.replace('.', '') || 'code';
      const issueList = detectedIssues
        .filter(i => i.severity === 'critical' || i.severity === 'high')
        .slice(0, 10)
        .map(i => `Line ${i.line}: [${i.severity.toUpperCase()}] ${i.category} — ${i.message}`)
        .join('\n');

      const systemPrompt = `You are an expert code auto-fixer. You will receive code with known issues and must return the fully corrected version.

STRICT RULES:
- Return ONLY valid JSON: {"fixed": "<complete corrected code>", "changes": ["<change 1>", "<change 2>", ...], "hasChanges": true/false}
- Fix ALL listed issues plus any other obvious bugs you spot
- Preserve original code style, indentation, and structure
- Do NOT add comments explaining changes — just fix the code
- The "fixed" field must be the COMPLETE file content, not a diff
- The "changes" array should list each specific fix made (max 10 items)`;

      const raw = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `File: ${file.name} (${lang})\n\nKnown issues to fix:\n${issueList}\n\nCode:\n\`\`\`${lang}\n${currentContent.slice(0, 8000)}\n\`\`\``,
          },
        ],
        maxTokens: 4000,
        temperature: 0.05,
        jsonMode: true,
      });

      const result = JSON.parse(raw);

      if (!result.hasChanges || !result.fixed) {
        setAutoFixResult({ hasChanges: false, changes: [], appliedAt: Date.now() });
        return;
      }

      // Auto-save the fixed content to disk
      const writeResult = await window.electronAPI.writeFile(file.path, result.fixed);
      if (!writeResult.success) throw new Error(writeResult.error || 'Failed to write file');

      lastFixedContent.current = result.fixed;

      setAutoFixResult({
        hasChanges: true,
        changes: result.changes || [],
        appliedAt: Date.now(),
        issuesFixed: detectedIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length,
      });

      // Notify parent to reload the file content
      if (onContentFixed) onContentFixed(file.path, result.fixed);

    } catch (err) {
      setAutoFixError(err.message);
    } finally {
      setAutoFixing(false);
    }
  }, [apiKey, aiSettings, onContentFixed]);

  // ── Manual AI deep scan ─────────────────────────────────────────────────────
  const handleAiScan = useCallback(async () => {
    if (!apiKey || !content || !selectedFile) return;
    setAiScanning(true);
    setAiIssues(null);
    try {
      const raw = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          {
            role: 'system',
            content: `You are a senior code reviewer. Analyze the code for bugs, risks, and code quality issues.
Return ONLY valid JSON: {"issues": [{"line": <number>, "severity": "critical|high|medium|low", "category": "<string>", "message": "<string>", "suggestion": "<string>"}]}
Max 15 issues. Return empty array if clean.`,
          },
          { role: 'user', content: `File: ${selectedFile.name}\n\n\`\`\`\n${content.slice(0, 6000)}\n\`\`\`` },
        ],
        maxTokens: 1500,
        temperature: 0.1,
        jsonMode: true,
      });
      const parsed = JSON.parse(raw);
      setAiIssues(parsed.issues || []);
    } catch (err) {
      setAiIssues([{ line: 0, severity: 'low', category: 'Error', message: `AI scan failed: ${err.message}`, suggestion: '' }]);
    } finally {
      setAiScanning(false);
    }
  }, [apiKey, aiSettings, content, selectedFile]);

  // ── Manual trigger auto-fix ─────────────────────────────────────────────────
  const handleManualAutoFix = () => {
    if (issues && selectedFile && content) {
      lastFixedContent.current = null; // force re-fix
      runAutoFix(content, selectedFile, issues);
    }
  };

  const toggleAutoFix = () => {
    const next = !autoFixEnabled;
    setAutoFixEnabled(next);
    localStorage.setItem('cw_autofix', String(next));
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const allIssues = [
    ...(issues || []),
    ...(aiIssues || []).map(i => ({ ...i, icon: '🤖', fromAI: true })),
  ].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.line - b.line);

  const filtered = filter === 'all' ? allIssues : allIssues.filter(i => i.severity === filter);

  const counts = SEVERITY_ORDER.reduce((acc, s) => {
    acc[s] = allIssues.filter(i => i.severity === s).length;
    return acc;
  }, {});

  const riskScore = counts.critical * 10 + counts.high * 5 + counts.medium * 2 + counts.low;
  const riskLabel =
    riskScore === 0  ? { text: 'Clean',       color: 'var(--success)' } :
    riskScore < 5   ? { text: 'Low Risk',     color: '#4ec9b0' } :
    riskScore < 15  ? { text: 'Medium Risk',  color: 'var(--warning)' } :
    riskScore < 30  ? { text: 'High Risk',    color: '#e07b39' } :
                      { text: 'Critical',     color: 'var(--error)' };

  const toggleExpand = (idx) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    return next;
  });

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="bug-panel">

      {/* ── Header ── */}
      <div className="bug-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🐛 Bug Detector</span>
          {selectedFile && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedFile.name}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {apiKey && selectedFile && (
            <button className="btn btn-secondary" style={{ fontSize: 10, padding: '2px 7px' }}
              onClick={handleAiScan} disabled={aiScanning}>
              {aiScanning ? <><span className="spinner" style={{ width: 10, height: 10 }} /> Scanning</> : '🤖 Deep Scan'}
            </button>
          )}
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Auto-fix toggle + status ── */}
      {apiKey && (
        <div className="autofix-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {/* Toggle switch */}
            <button
              className={`autofix-toggle ${autoFixEnabled ? 'on' : 'off'}`}
              onClick={toggleAutoFix}
              title={autoFixEnabled ? 'Auto-fix is ON — click to disable' : 'Auto-fix is OFF — click to enable'}
            >
              <span className="autofix-toggle-knob" />
            </button>
            <span style={{ fontSize: 11, color: autoFixEnabled ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
              {autoFixEnabled ? '⚡ Auto-Fix ON' : 'Auto-Fix OFF'}
            </span>
            {autoFixEnabled && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                fixes critical/high issues automatically
              </span>
            )}
          </div>

          {/* Manual trigger */}
          {issues && issues.filter(i => i.severity === 'critical' || i.severity === 'high').length > 0 && (
            <button
              className="btn btn-fix"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={handleManualAutoFix}
              disabled={autoFixing}
              title="Fix all critical and high issues now"
            >
              {autoFixing
                ? <><span className="spinner" style={{ width: 10, height: 10 }} /> Fixing...</>
                : '🔧 Fix Now'}
            </button>
          )}
        </div>
      )}

      {/* ── Auto-fix in progress ── */}
      {autoFixing && (
        <div className="autofix-progress">
          <span className="spinner" style={{ borderTopColor: 'var(--success)', borderColor: 'rgba(78,201,176,0.2)', width: 14, height: 14 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 11 }}>Auto-fixing issues...</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>AI is rewriting the file</div>
          </div>
        </div>
      )}

      {/* ── Auto-fix result ── */}
      {autoFixResult && !autoFixing && (
        <div className={`autofix-result ${autoFixResult.hasChanges ? 'success' : 'clean'}`}>
          {autoFixResult.hasChanges ? (
            <>
              <div className="autofix-result-header">
                <span>✅ Auto-fixed {autoFixResult.issuesFixed} issue{autoFixResult.issuesFixed !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatTime(autoFixResult.appliedAt)}</span>
                <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setAutoFixResult(null)}>✕</button>
              </div>
              {autoFixResult.changes.length > 0 && (
                <ul className="autofix-changes">
                  {autoFixResult.changes.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              )}
              <button
                className="btn btn-secondary"
                style={{ fontSize: 10, padding: '2px 8px', marginTop: 6 }}
                onClick={async () => {
                  const r = await window.electronAPI.restoreBackup(selectedFile.path);
                  if (r.success) {
                    setAutoFixResult(null);
                    lastFixedContent.current = null;
                    if (onContentFixed) onContentFixed(selectedFile.path, null);
                  }
                }}
              >
                ↩ Undo (restore backup)
              </button>
            </>
          ) : (
            <span style={{ fontSize: 11 }}>✅ Code is already clean — no changes needed</span>
          )}
        </div>
      )}

      {/* ── Auto-fix error ── */}
      {autoFixError && (
        <div className="autofix-result error">
          <span style={{ fontSize: 11 }}>⚠️ Auto-fix failed: {autoFixError}</span>
          <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setAutoFixError(null)}>✕</button>
        </div>
      )}

      {/* ── Risk score bar ── */}
      {issues !== null && (
        <div className="bug-score-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: riskLabel.color }}>{riskLabel.text}</span>
            <div className="bug-score-track">
              <div className="bug-score-fill" style={{ width: `${Math.min(100, riskScore * 2)}%`, background: riskLabel.color }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{riskScore}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {SEVERITY_ORDER.map(s => counts[s] > 0 && (
              <span key={s} className={`bug-severity-pill ${filter === s ? 'active' : ''}`}
                style={{ '--scolor': SEVERITY_COLOR[s], '--sbg': SEVERITY_BG[s] }}
                onClick={() => setFilter(f => f === s ? 'all' : s)}>
                {counts[s]} {s}
              </span>
            ))}
            {allIssues.length > 0 && (
              <span className={`bug-severity-pill ${filter === 'all' ? 'active' : ''}`}
                style={{ '--scolor': 'var(--text-muted)', '--sbg': 'rgba(133,133,133,0.08)' }}
                onClick={() => setFilter('all')}>all</span>
            )}
          </div>
        </div>
      )}

      {/* ── Issue list ── */}
      <div className="bug-list">
        {scanning && (
          <div className="bug-empty">
            <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)' }} />
            Scanning...
          </div>
        )}

        {!scanning && !selectedFile && (
          <div className="bug-empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28, opacity: 0.3 }}>🐛</span>
            <span>Open a file to scan</span>
          </div>
        )}

        {!scanning && selectedFile && filtered.length === 0 && (
          <div className="bug-empty" style={{ flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <span style={{ color: 'var(--success)' }}>
              {filter === 'all' ? 'No issues detected!' : `No ${filter} issues`}
            </span>
          </div>
        )}

        {!scanning && filtered.map((issue, idx) => (
          <div key={idx} className="bug-issue"
            style={{ '--issue-color': SEVERITY_COLOR[issue.severity], '--issue-bg': SEVERITY_BG[issue.severity] }}
            onClick={() => toggleExpand(idx)}>
            <div className="bug-issue-header">
              <span className="bug-issue-icon">{issue.icon || '⚠️'}</span>
              <span className="bug-issue-line">L{issue.line}</span>
              <span className="bug-issue-category">{issue.category}</span>
              {issue.fromAI && <span className="bug-ai-badge">AI</span>}
              <span className="bug-issue-expand">{expanded.has(idx) ? '▾' : '▸'}</span>
            </div>
            <div className="bug-issue-message">{issue.message}</div>
            {expanded.has(idx) && (
              <div className="bug-issue-detail">
                {issue.snippet && <pre className="bug-snippet">{issue.snippet}</pre>}
                {issue.suggestion && (
                  <div className="bug-suggestion">
                    <span style={{ color: 'var(--success)' }}>💡 Fix: </span>{issue.suggestion}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {aiScanning && (
          <div className="bug-ai-scanning">
            <span className="spinner" style={{ borderTopColor: '#3178c6', borderColor: 'rgba(49,120,198,0.2)' }} />
            AI analyzing...
          </div>
        )}
      </div>
    </div>
  );
}
