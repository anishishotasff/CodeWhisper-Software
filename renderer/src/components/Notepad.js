import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatComplete } from '../utils/aiProvider';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelative = (ts) => {
  const diff = Date.now() - ts;
  if (diff < 60000)  return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return formatDate(ts);
};

export default function Notepad({ onClose, apiKey, aiSettings, selectedFile, fileContent }) {
  const [notes, setNotes]         = useState([]);
  const [activeId, setActiveId]   = useState(null);
  const [search, setSearch]       = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [linkingFile, setLinkingFile] = useState(false);
  const saveTimer  = useRef(null);
  const textareaRef = useRef(null);

  // ── Load from disk ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.notepadLoad().then(loaded => {
      if (loaded.length > 0) {
        setNotes(loaded);
        setActiveId(loaded[0].id);
      } else {
        const first = {
          id: uid(), title: 'Welcome to Notepad', content: '# CodeWhisper Notepad\n\nUse this to:\n- Save important code snippets\n- Link notes to files\n- Ask AI to explain your notes\n\nPin any open file with the 📌 Pin button.',
          createdAt: Date.now(), updatedAt: Date.now(), linkedFile: null,
        };
        setNotes([first]);
        setActiveId(first.id);
      }
    });
  }, []);

  // ── Auto-save with status indicator ────────────────────────────────────────
  useEffect(() => {
    if (notes.length === 0) return;
    setSaveStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      await window.electronAPI.notepadSave(notes);
      setSaveStatus('saved');
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [notes]);

  // ── Listen for pin-file events ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => pinFileAsNote(e.detail.filePath, e.detail.content);
    window.addEventListener('codewhisper:pinFile', handler);
    return () => window.removeEventListener('codewhisper:pinFile', handler);
  }, []); // eslint-disable-line

  const activeNote = notes.find(n => n.id === activeId) || null;

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const createNote = () => {
    const note = {
      id: uid(), title: 'Untitled', content: '',
      createdAt: Date.now(), updatedAt: Date.now(), linkedFile: null,
    };
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setExplanation(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const deleteNote = (id) => {
    const remaining = notes.filter(n => n.id !== id);
    setNotes(remaining);
    if (activeId === id) { setActiveId(remaining[0]?.id || null); setExplanation(null); }
  };

  const updateNote = useCallback((id, patch) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  }, []);

  // ── Pin file as note ────────────────────────────────────────────────────────
  const pinFileAsNote = (filePath, content) => {
    const name = filePath.split(/[\\/]/).pop();
    const note = {
      id: uid(),
      title: `📌 ${name}`,
      content: content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      linkedFile: filePath,
      pinned: true,
    };
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setExplanation(null);
  };

  // ── Link current open file to active note ───────────────────────────────────
  const handleLinkFile = () => {
    if (!activeNote || !selectedFile) return;
    updateNote(activeNote.id, { linkedFile: selectedFile.path });
    setLinkingFile(false);
  };

  const handleUnlinkFile = () => {
    if (!activeNote) return;
    updateNote(activeNote.id, { linkedFile: null });
  };

  // Reload linked file content into note
  const handleReloadLinked = async () => {
    if (!activeNote?.linkedFile) return;
    const result = await window.electronAPI.readFile(activeNote.linkedFile);
    updateNote(activeNote.id, { content: result.content });
  };

  // ── "Explain this note with code" ──────────────────────────────────────────
  const handleExplain = useCallback(async () => {
    if (!activeNote || !apiKey) return;
    setExplaining(true);
    setExplanation(null);

    try {
      // Build context: note content + linked file content if available
      let linkedContent = '';
      if (activeNote.linkedFile) {
        const result = await window.electronAPI.readFile(activeNote.linkedFile);
        linkedContent = result.content.slice(0, 3000);
      } else if (fileContent) {
        linkedContent = fileContent.slice(0, 3000);
      }

      const prompt = linkedContent
        ? `Here is a developer note:\n\n"${activeNote.content.slice(0, 1500)}"\n\nAnd here is the related code:\n\`\`\`\n${linkedContent}\n\`\`\`\n\nExplain what this note means in the context of the code. Be specific, concise, and developer-friendly.`
        : `Explain this developer note clearly and concisely:\n\n"${activeNote.content.slice(0, 2000)}"`;

      const reply = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          { role: 'system', content: 'You are a senior developer helping explain code notes. Be concise and practical.' },
          { role: 'user', content: prompt },
        ],
        maxTokens: 600,
        temperature: 0.3,
      });
      setExplanation(reply);
    } catch (err) {
      setExplanation(`❌ ${err.message}`);
    } finally {
      setExplaining(false);
    }
  }, [activeNote, apiKey, fileContent]);

  // ── Insert snippet from current file ───────────────────────────────────────
  const handleInsertSnippet = () => {
    if (!activeNote || !fileContent) return;
    const snippet = `\n\n\`\`\`\n// From: ${selectedFile?.name || 'current file'}\n${fileContent.slice(0, 500)}\n\`\`\`\n`;
    updateNote(activeNote.id, { content: activeNote.content + snippet });
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  };

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    (n.linkedFile || '').toLowerCase().includes(search.toLowerCase())
  );

  const linkedFileName = activeNote?.linkedFile
    ? activeNote.linkedFile.split(/[\\/]/).pop()
    : null;

  return (
    <div className="notepad-overlay">
      <div className="notepad-modal">

        {/* ── Header ── */}
        <div className="notepad-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="notepad-title">📝 Smart Notepad</span>
            {/* Auto-save status */}
            <span className={`notepad-save-status ${saveStatus}`}>
              {saveStatus === 'saved'   && '✓ Saved'}
              {saveStatus === 'saving'  && '⟳ Saving...'}
              {saveStatus === 'unsaved' && '● Unsaved'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={createNote}>
              + New
            </button>
            <button className="btn btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="notepad-body">

          {/* ── Note list ── */}
          <div className="notepad-list">
            <div className="notepad-search-wrap">
              <input
                className="notepad-search"
                placeholder="🔍 Search notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="notepad-items">
              {filtered.length === 0 && (
                <div style={{ padding: '20px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                  No notes found
                </div>
              )}
              {filtered.map(note => (
                <div
                  key={note.id}
                  className={`notepad-item ${activeId === note.id ? 'active' : ''}`}
                  onClick={() => { setActiveId(note.id); setExplanation(null); }}
                >
                  <div className="notepad-item-title">{note.title || 'Untitled'}</div>
                  {/* Linked file badge */}
                  {note.linkedFile && (
                    <div className="notepad-linked-badge">
                      🔗 {note.linkedFile.split(/[\\/]/).pop()}
                    </div>
                  )}
                  <div className="notepad-item-preview">
                    {note.content.slice(0, 55).replace(/\n/g, ' ') || 'Empty note'}
                  </div>
                  <div className="notepad-item-date">{formatRelative(note.updatedAt)}</div>
                  <button
                    className="notepad-delete-btn"
                    onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Editor ── */}
          <div className="notepad-editor">
            {activeNote ? (
              <>
                {/* Title */}
                <input
                  className="notepad-editor-title"
                  value={activeNote.title}
                  onChange={e => updateNote(activeNote.id, { title: e.target.value })}
                  placeholder="Note title..."
                />

                {/* Toolbar */}
                <div className="notepad-toolbar">
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
                    {/* Link file */}
                    {!activeNote.linkedFile ? (
                      <button
                        className="notepad-tool-btn"
                        onClick={handleLinkFile}
                        disabled={!selectedFile}
                        title={selectedFile ? `Link to ${selectedFile.name}` : 'Open a file first'}
                      >
                        🔗 Link {selectedFile ? selectedFile.name : 'file'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span className="notepad-file-link">
                          🔗 {linkedFileName}
                        </span>
                        <button className="notepad-tool-btn" onClick={handleReloadLinked} title="Reload file content">↺</button>
                        <button className="notepad-tool-btn danger" onClick={handleUnlinkFile} title="Unlink">✕</button>
                      </div>
                    )}

                    {/* Insert snippet */}
                    {fileContent && (
                      <button className="notepad-tool-btn" onClick={handleInsertSnippet} title="Insert current file snippet">
                        ⬇ Insert Snippet
                      </button>
                    )}

                    {/* Explain with AI */}
                    {apiKey && (
                      <button
                        className="notepad-tool-btn ai"
                        onClick={handleExplain}
                        disabled={explaining || !activeNote.content.trim()}
                        title="Ask AI to explain this note in context of the linked/open file"
                      >
                        {explaining
                          ? <><span className="spinner" style={{ width: 10, height: 10 }} /> Explaining...</>
                          : '🤖 Explain with Code'}
                      </button>
                    )}
                  </div>

                  {/* Meta */}
                  <span className="notepad-meta">
                    {activeNote.content.length} chars · {activeNote.content.split('\n').length} lines · {formatRelative(activeNote.updatedAt)}
                  </span>
                </div>

                {/* AI Explanation panel */}
                {explanation && (
                  <div className="notepad-explanation">
                    <div className="notepad-explanation-header">
                      <span>🤖 AI Explanation</span>
                      <button className="btn btn-icon" style={{ fontSize: 10 }} onClick={() => setExplanation(null)}>✕</button>
                    </div>
                    <div className="notepad-explanation-body">{explanation}</div>
                  </div>
                )}

                {/* Content editor */}
                <textarea
                  ref={textareaRef}
                  className="notepad-editor-content"
                  value={activeNote.content}
                  onChange={e => updateNote(activeNote.id, { content: e.target.value })}
                  placeholder={`Write notes, paste code snippets, or link a file above.\n\nTips:\n• Link a file to give AI context when explaining\n• Use "Insert Snippet" to paste the current file\n• Click "Explain with Code" to get AI analysis`}
                  spellCheck={false}
                />
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 12 }}>
                <span style={{ fontSize: 36, opacity: 0.3 }}>📝</span>
                <span>Select a note or create a new one</span>
                <button className="btn btn-primary" style={{ fontSize: 11 }} onClick={createNote}>+ New Note</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
