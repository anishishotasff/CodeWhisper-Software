import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import BugRiskPanel from './BugRiskPanel';
import LivePreview, { canPreview } from './LivePreview';
import IntelligencePanel from './IntelligencePanel';
import SmartActionPopup from './SmartActionPopup';
import { chatComplete } from '../utils/aiProvider';
import { hasCredits, deductCredits, CREDIT_COSTS } from '../utils/creditsManager';
import { formatWithPrettier, findTodos, getErrorLensAnnotations, trackWakaTime, getWakaStats, isInstalled } from '../utils/extensionsEngine';

function getLang(ext) {
  const map = {
    '.js': 'javascript', '.jsx': 'jsx', '.ts': 'typescript', '.tsx': 'tsx',
    '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c',
    '.html': 'html', '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    '.md': 'markdown', '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
    '.sql': 'sql', '.graphql': 'graphql', '.xml': 'xml',
    '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  };
  return map[ext] || 'text';
}

// Files that shouldn't be edited (binary / too large)
const NON_EDITABLE = new Set(['.png','.jpg','.jpeg','.gif','.svg','.ico','.woff','.woff2','.ttf','.eot','.mp4','.mp3','.zip','.tar','.gz']);

export default function CodeViewer({
  selectedFile, content, summary, analyzing,
  onPinToNotepad, apiKey, aiSettings, liveReload, onCreditUsed,
}) {
  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]       = useState(false);
  const [editContent, setEditContent] = useState('');
  const [unsaved, setUnsaved]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState(null); // 'saved' | 'error'
  const textareaRef = useRef(null);
  const saveTimer   = useRef(null);

  // ── Fix / bug state ──────────────────────────────────────────────────────────
  const [fixing, setFixing]       = useState(false);
  const [fixResult, setFixResult] = useState(null);
  const [fixError, setFixError]   = useState(null);
  const [showDiff, setShowDiff]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [showBugs, setShowBugs]   = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [showTodos, setShowTodos] = useState(false);

  // Smart action popup state
  const [smartPopup, setSmartPopup] = useState(null); // { text, position }

  // ── Enter edit mode when file changes ────────────────────────────────────────
  useEffect(() => {
    setEditMode(false);
    setUnsaved(false);
    setFixResult(null);
    setFixError(null);
    setShowDiff(false);
    setShowTodos(false);
    // Auto-open preview for HTML/CSS/MD files
    setShowPreview(selectedFile ? canPreview(selectedFile.ext) : false);
    // Track WakaTime
    if (selectedFile) trackWakaTime(selectedFile.name);
  }, [selectedFile?.path]); // eslint-disable-line

  // Sync editContent when content prop changes (live reload / fix applied)
  useEffect(() => {
    if (!editMode) setEditContent(content || '');
  }, [content]); // eslint-disable-line

  // ── Smart Action Popup — fires on text selection in viewer ────────────────
  const handleMouseUp = useCallback((e) => {
    if (editMode) return; // don't interfere with editor
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 3 && text.length < 2000) {
      setSmartPopup({ text, position: { x: e.clientX, y: e.clientY } });
    } else if (!text) {
      setSmartPopup(null);
    }
  }, [editMode]);

  // ── Enter edit mode ──────────────────────────────────────────────────────────
  const enterEditMode = () => {
    setEditContent(content || '');
    setEditMode(true);
    setUnsaved(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const exitEditMode = () => {
    if (unsaved) {
      if (!window.confirm('Discard unsaved changes?')) return;
    }
    setEditMode(false);
    setUnsaved(false);
  };

  // ── Handle textarea changes ──────────────────────────────────────────────────
  const handleEdit = (e) => {
    setEditContent(e.target.value);
    setUnsaved(true);
    setSaveMsg(null);
    // Auto-save after 2s of inactivity
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveFile(e.target.value), 2000);
  };

  // ── Tab key → insert 2 spaces ────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    // Ctrl+S / Cmd+S → save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      clearTimeout(saveTimer.current);
      saveFile(editContent);
      return;
    }
    // Tab → indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const indent = '  '; // 2 spaces

      if (e.shiftKey) {
        // Shift+Tab → unindent selected lines
        const before = editContent.slice(0, start);
        const selected = editContent.slice(start, end);
        const after = editContent.slice(end);
        const unindented = selected.replace(/^  /gm, '');
        const newVal = before + unindented + after;
        setEditContent(newVal);
        setUnsaved(true);
        setTimeout(() => { ta.selectionStart = start; ta.selectionEnd = start + unindented.length; }, 0);
      } else if (start !== end) {
        // Multi-line indent
        const before = editContent.slice(0, start);
        const selected = editContent.slice(start, end);
        const after = editContent.slice(end);
        const indented = selected.replace(/^/gm, indent);
        const newVal = before + indented + after;
        setEditContent(newVal);
        setUnsaved(true);
        setTimeout(() => { ta.selectionStart = start; ta.selectionEnd = start + indented.length; }, 0);
      } else {
        // Single cursor → insert indent
        const newVal = editContent.slice(0, start) + indent + editContent.slice(end);
        setEditContent(newVal);
        setUnsaved(true);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + indent.length; }, 0);
      }
    }
    // Enter → auto-indent to match current line
    if (e.key === 'Enter') {
      e.preventDefault();
      const ta = textareaRef.current;
      const pos = ta.selectionStart;
      const lineStart = editContent.lastIndexOf('\n', pos - 1) + 1;
      const currentLine = editContent.slice(lineStart, pos);
      const indent = currentLine.match(/^(\s*)/)[1];
      const newVal = editContent.slice(0, pos) + '\n' + indent + editContent.slice(pos);
      setEditContent(newVal);
      setUnsaved(true);
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = pos + 1 + indent.length; }, 0);
    }
  };

  // ── Save file ────────────────────────────────────────────────────────────────
  const saveFile = useCallback(async (val) => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      let contentToSave = val ?? editContent;

      // Prettier format on save if installed
      if (isInstalled('prettier')) {
        const formatted = await formatWithPrettier(contentToSave, selectedFile.ext);
        if (formatted && formatted !== contentToSave) {
          contentToSave = formatted;
          setEditContent(formatted);
        }
      }

      const result = await window.electronAPI.writeFile(selectedFile.path, contentToSave);
      if (result.success) {
        setUnsaved(false);
        setSaveMsg('saved');
        setTimeout(() => setSaveMsg(null), 2000);
        window.dispatchEvent(new CustomEvent('codewhisper:fileFixed', {
          detail: { path: selectedFile.path, content: contentToSave }
        }));
      } else {
        setSaveMsg('error');
      }
    } catch {
      setSaveMsg('error');
    } finally {
      setSaving(false);
    }
  }, [selectedFile, editContent]);

  // ── Copy ─────────────────────────────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(editMode ? editContent : content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── AI Fix Errors ────────────────────────────────────────────────────────────
  const handleFixErrors = useCallback(async () => {
    if (!selectedFile || !content || !apiKey) return;

    // Check credits (skip for Ollama)
    if (aiSettings?.provider !== 'ollama') {
      if (!hasCredits(CREDIT_COSTS.BUG_FIX)) {
        setFixError('⚡ Out of credits. Resets next month or upgrade to Premium.');
        return;
      }
      deductCredits(CREDIT_COSTS.BUG_FIX);
      onCreditUsed?.();
    }

    setFixing(true); setFixResult(null); setFixError(null);
    try {
      const lang = getLang(selectedFile.ext);
      const raw = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          {
            role: 'system',
            content: `You are an expert code debugger. Return ONLY valid JSON:
{"fixed": "<complete corrected code>", "explanation": "<bullet list of fixes>", "hasErrors": true/false}
Fix all bugs, syntax errors, logic issues. Preserve style. If no errors, set hasErrors to false.`,
          },
          { role: 'user', content: `Language: ${lang}\nFile: ${selectedFile.name}\n\n\`\`\`${lang}\n${content.slice(0, 8000)}\n\`\`\`` },
        ],
        maxTokens: 4000, temperature: 0.1, jsonMode: true,
      });
      const result = JSON.parse(raw);
      setFixResult({ original: content, ...result });
      setShowDiff(result.hasErrors);
    } catch (err) {
      setFixError(err.message);
    } finally {
      setFixing(false);
    }
  }, [selectedFile, content, apiKey, aiSettings]);

  const handleApplyFix = async () => {
    if (!fixResult || !selectedFile) return;
    const r = await window.electronAPI.writeFile(selectedFile.path, fixResult.fixed);
    if (r.success) {
      setFixResult(null); setShowDiff(false);
      window.dispatchEvent(new CustomEvent('codewhisper:fileFixed', {
        detail: { path: selectedFile.path, content: fixResult.fixed }
      }));
    }
  };

  // ── Summary view ─────────────────────────────────────────────────────────────
  if (!selectedFile && summary) {
    return (
      <main className="code-viewer">
        <div className="code-viewer-header">
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>📊 Project Analysis</span>
        </div>
        <div className="code-content"><div className="summary-panel">{summary}</div></div>
      </main>
    );
  }

  if (!selectedFile) {
    return (
      <main className="code-viewer">
        <div className="empty-state">
          <div className="empty-state-icon">💻</div>
          <div className="empty-state-text">Select a file to view or edit</div>
          {analyzing && (
            <div style={{ color: 'var(--accent)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)' }} />
              Analyzing project...
            </div>
          )}
        </div>
      </main>
    );
  }

  const lang = getLang(selectedFile.ext);
  const canEdit = !NON_EDITABLE.has(selectedFile.ext);
  const displayContent = (showDiff && fixResult) ? fixResult.fixed : content;
  const lineCount = (editMode ? editContent : displayContent || '').split('\n').length;

  return (
    <main className="code-viewer">

      {/* ── Header ── */}
      <div className="code-viewer-header">
        <div className="file-tab">
          <span>{selectedFile.name}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{selectedFile.ext || 'file'}</span>
          {editMode && unsaved && <span className="editor-unsaved-dot" title="Unsaved changes" />}
        </div>

        {/* Edit / View toggle */}
        {canEdit && (
          <div className="editor-mode-toggle">
            <button
              className={`mode-btn ${!editMode ? 'active' : ''}`}
              onClick={exitEditMode}
              title="View mode"
            >👁 View</button>
            <button
              className={`mode-btn ${editMode ? 'active' : ''}`}
              onClick={enterEditMode}
              title="Edit mode — Ctrl+S to save"
            >✏️ Edit</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6 }}>
          {/* Line count */}
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{lineCount} lines</span>

          {/* Save status */}
          {editMode && (
            <span className={`editor-save-status ${saveMsg || (unsaved ? 'unsaved' : 'saved')}`}>
              {saving ? '⟳' : saveMsg === 'saved' ? '✓ Saved' : saveMsg === 'error' ? '✗ Error' : unsaved ? '● Unsaved' : '✓ Saved'}
            </span>
          )}

          {liveReload && liveReload.path === selectedFile?.path && (
            <span className="live-badge">🔴 Live</span>
          )}

          <motion.button
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 7px' }}
            onClick={() => onPinToNotepad?.(selectedFile.path, editMode ? editContent : content)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            title="Pin to Notepad"
          >📌</motion.button>

          <motion.button
            className="btn btn-secondary"
            style={{ fontSize: 11, padding: '3px 7px' }}
            onClick={handleCopy}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
          >
            {copied ? '✓' : '📋'}
          </motion.button>

          {apiKey && !editMode && (
            <button className="btn btn-fix" style={{ fontSize: 11, padding: '3px 9px' }}
              onClick={handleFixErrors} disabled={fixing}>
              {fixing ? <><span className="spinner" /> Fixing...</> : '🔧 Fix'}
            </button>
          )}

          {editMode && (
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => { clearTimeout(saveTimer.current); saveFile(editContent); }}
              disabled={saving || !unsaved}
              title="Ctrl+S">
              {saving ? <><span className="spinner" /> Saving...</> : '💾 Save'}
            </button>
          )}

          <button className={`btn ${showBugs ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 11, padding: '3px 9px' }}
            onClick={() => setShowBugs(v => !v)}>
            🐛 {showBugs ? 'Hide' : 'Bugs'}
          </button>

          {/* TODO Highlight */}
          {isInstalled('todo-highlight') && (
            <button className={`btn ${showTodos ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 11, padding: '3px 9px' }}
              onClick={() => setShowTodos(v => !v)}>
              📌 TODOs ({findTodos(editMode ? editContent : content || '', selectedFile?.ext || '').length})
            </button>
          )}

          {/* WakaTime */}
          {isInstalled('wakatime') && getWakaStats() && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '2px 6px', background: 'rgba(168,85,247,0.08)', borderRadius: 3 }}>
              ⏱ {getWakaStats()}
            </span>
          )}

          {/* Intelligence panel */}
          <button
            className={`btn ${showIntel ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 11, padding: '3px 9px' }}
            onClick={() => setShowIntel(v => !v)}
            title="Intelligence: Flow, Impact, Improve, Quality, Search"
          >
            🧠 {showIntel ? 'Hide' : 'Intel'}
          </button>

          {/* Live Preview toggle — only for previewable files */}
          {canPreview(selectedFile?.ext) && (
            <button
              className={`btn ${showPreview ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 11, padding: '3px 9px' }}
              onClick={() => setShowPreview(v => !v)}
              title="Toggle live preview"
            >
              {showPreview ? '👁 Hide Preview' : '👁 Preview'}
            </button>
          )}
        </div>
      </div>

      {/* ── Fix banners ── */}
      {fixError && (
        <div className="fix-banner fix-banner-error">
          ⚠️ {fixError}
          <button className="btn btn-icon" onClick={() => setFixError(null)}>✕</button>
        </div>
      )}
      {fixResult && (
        <div className={`fix-banner ${fixResult.hasErrors ? 'fix-banner-success' : 'fix-banner-clean'}`}>
          {fixResult.hasErrors ? (
            <>
              <div style={{ flex: 1 }}>
                <strong>🔧 Fixed:</strong>
                <div style={{ marginTop: 3, fontSize: 11, whiteSpace: 'pre-wrap', opacity: 0.9 }}>{fixResult.explanation}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setShowDiff(v => !v)}>
                  {showDiff ? 'Original' : 'Fixed'}
                </button>
                <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={handleApplyFix}>✅ Apply</button>
                <button className="btn btn-icon" onClick={() => setFixResult(null)}>✕</button>
              </div>
            </>
          ) : (
            <><span>✅ Code looks clean!</span><button className="btn btn-icon" onClick={() => setFixResult(null)}>✕</button></>
          )}
        </div>
      )}

      {/* ── Edit mode hint ── */}
      {editMode && (
        <div className="editor-hint-bar">
          <span>✏️ Editing — <kbd>Ctrl+S</kbd> save · <kbd>Tab</kbd> indent · <kbd>Shift+Tab</kbd> unindent · <kbd>Enter</kbd> auto-indent</span>
          {unsaved && <span style={{ color: 'var(--warning)', marginLeft: 'auto' }}>Unsaved changes</span>}
        </div>
      )}

      {/* ── TODO Panel ── */}
      {showTodos && isInstalled('todo-highlight') && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-tertiary)', maxHeight: 140, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            📌 TODOs & FIXMEs
          </div>
          {findTodos(editMode ? editContent : content || '', selectedFile?.ext || '').length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No TODOs found ✓</div>
          ) : (
            findTodos(editMode ? editContent : content || '', selectedFile?.ext || '').map((todo, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: todo.color, fontWeight: 700, minWidth: 50 }}>{todo.type}</span>
                <span style={{ color: 'var(--text-muted)' }}>Line {todo.line}:</span>
                <span style={{ color: 'var(--text-primary)' }}>{todo.text}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Main content area ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} onMouseUp={handleMouseUp}>

        {/* Editor / Viewer — shrinks when preview is open */}
        <div style={{ display: 'flex', flex: showPreview ? '0 0 50%' : 1, overflow: 'hidden', borderRight: showPreview ? '1px solid var(--border)' : 'none' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedFile?.path || 'empty'}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
            >
              {editMode ? (
                /* ── CODE EDITOR ── */
                <div className="code-editor-wrap">
                  <div className="code-editor-lines" aria-hidden="true">
                    {editContent.split('\n').map((_, i) => (
                      <div key={i} className="code-editor-line-num">{i + 1}</div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="code-editor-textarea"
                    value={editContent}
                    onChange={handleEdit}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>
              ) : (
                /* ── SYNTAX HIGHLIGHTED VIEWER ── */
                <div className="code-content" style={{ flex: 1 }}>
                  <SyntaxHighlighter
                    language={lang}
                    style={vscDarkPlus}
                    showLineNumbers
                    lineNumberStyle={{ color: '#4a4a4a', minWidth: '2.5em' }}
                    customStyle={{ margin: 0, borderRadius: 0, fontSize: 13, height: '100%' }}
                    wrapLongLines={false}
                  >
                    {displayContent || ''}
                  </SyntaxHighlighter>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Live Preview panel ── */}
        {showPreview && (
          <LivePreview
            selectedFile={selectedFile}
            content={content}
            editContent={editMode ? editContent : content}
            isEditing={editMode}
          />
        )}

        {/* ── Bug panel ── */}
        {showBugs && (
          <BugRiskPanel
            selectedFile={selectedFile}
            content={editMode ? editContent : content}
            apiKey={apiKey}
            aiSettings={aiSettings}
            onClose={() => setShowBugs(false)}
            onContentFixed={async (filePath, fixedContent) => {
              if (fixedContent) {
                if (editMode) setEditContent(fixedContent);
                window.dispatchEvent(new CustomEvent('codewhisper:fileFixed', {
                  detail: { path: filePath, content: fixedContent }
                }));
              } else {
                const reloaded = await window.electronAPI.readFile(filePath);
                if (editMode) setEditContent(reloaded.content);
                window.dispatchEvent(new CustomEvent('codewhisper:fileFixed', {
                  detail: { path: filePath, content: reloaded.content }
                }));
              }
            }}
          />
        )}
      </div>

      {/* ── Intelligence Panel ── */}
      <AnimatePresence>
        {showIntel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', borderLeft: '1px solid var(--border)' }}
          >
            <IntelligencePanel
              selectedFile={selectedFile}
              content={editMode ? editContent : content}
              projectPath={null}
              allFiles={null}
              aiSettings={aiSettings}
              apiKey={apiKey}
              onClose={() => setShowIntel(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Smart Action Popup ── */}
      {smartPopup && (
        <SmartActionPopup
          selectedText={smartPopup.text}
          position={smartPopup.position}
          aiSettings={aiSettings}
          apiKey={apiKey}
          onClose={() => setSmartPopup(null)}
          onApply={(fixedText) => {
            // Replace selected text in editor if in edit mode
            if (editMode && textareaRef.current) {
              const ta = textareaRef.current;
              const start = ta.selectionStart;
              const end   = ta.selectionEnd;
              const newVal = editContent.slice(0, start) + fixedText + editContent.slice(end);
              setEditContent(newVal);
              setUnsaved(true);
            }
          }}
        />
      )}
    </main>
  );
}
