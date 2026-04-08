import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatComplete } from '../utils/aiProvider';
import { hasCredits, deductCredits, CREDIT_COSTS } from '../utils/creditsManager';

const TEMPLATES = [
  { label: 'React App', prompt: 'Create a modern React app with components, routing, and a clean dark UI' },
  { label: 'Landing Page', prompt: 'Create a beautiful HTML/CSS/JS landing page with hero, features, and CTA sections' },
  { label: 'REST API', prompt: 'Create a Node.js Express REST API with routes, middleware, and error handling' },
  { label: 'Python Script', prompt: 'Create a Python utility script with argument parsing and clean structure' },
  { label: 'Portfolio Site', prompt: 'Create a personal portfolio website with HTML, CSS, and JavaScript' },
  { label: 'Todo App', prompt: 'Create a full todo app with React, local storage, and animations' },
];

const SYSTEM_PROMPT = `You are an expert software engineer. When given a project description, generate a complete, working project.

CRITICAL: Respond with ONLY valid JSON in this exact format:
{
  "projectName": "folder-name-kebab-case",
  "description": "one line description",
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "complete file content here"
    }
  ],
  "setupInstructions": "how to run this project"
}

Rules:
- Generate ALL necessary files (index.html, styles, scripts, package.json if needed)
- Write COMPLETE, working code — no placeholders, no TODOs
- Use modern best practices
- Keep it clean and well-commented
- For web projects: always include index.html, styles.css, and script.js at minimum
- For React: include package.json, src/App.js, src/index.js, public/index.html
- For Node.js: include package.json, index.js or server.js
- Maximum 15 files to keep it focused`;

export default function ProjectBuilder({ apiKey, aiSettings, onProjectCreated, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | thinking | generating | writing | done | error
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: Date.now() }]);
  };

  const pickOutputDir = async () => {
    const dir = await window.electronAPI.openFolder();
    if (dir) setOutputDir(dir);
  };

  const build = async () => {
    if (!prompt.trim()) return;
    if (!outputDir) { setError('Please select an output folder first'); return; }
    if (!apiKey) { setError('No AI key configured. Go to AI Settings.'); return; }

    // Check credits
    if (aiSettings?.provider !== 'ollama') {
      if (!hasCredits(CREDIT_COSTS.ANALYZE)) {
        setError('⚡ Not enough credits. Need 5 credits to build a project.');
        return;
      }
      deductCredits(CREDIT_COSTS.ANALYZE);
    }

    setPhase('thinking');
    setLog([]);
    setResult(null);
    setError('');

    addLog('🧠 Analyzing your prompt...', 'info');

    try {
      addLog('⚡ Generating project structure...', 'info');
      setPhase('generating');

      const raw = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === 'ollama' ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Build this project: ${prompt}` },
        ],
        maxTokens: 8000,
        temperature: 0.2,
        jsonMode: true,
      });

      addLog('📦 Parsing generated files...', 'info');

      let parsed;
      try {
        // Strip markdown code fences if present
        const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        throw new Error('AI returned invalid JSON. Try a simpler prompt.');
      }

      if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
        throw new Error('No files were generated. Try a more specific prompt.');
      }

      setPhase('writing');
      const projectDir = `${outputDir}/${parsed.projectName || 'codewhisper-project'}`;
      addLog(`📁 Creating project at: ${projectDir}`, 'info');

      // Write all files
      const filesToWrite = parsed.files.map(f => ({
        path: `${projectDir}/${f.path}`,
        content: f.content,
      }));

      const writeResults = await window.electronAPI.writeFiles(filesToWrite);
      const failed = writeResults.filter(r => !r.success);

      for (const r of writeResults) {
        if (r.success) {
          addLog(`✅ ${r.path.replace(projectDir + '/', '')}`, 'success');
        } else {
          addLog(`❌ Failed: ${r.path.replace(projectDir + '/', '')} — ${r.error}`, 'error');
        }
      }

      if (failed.length === writeResults.length) {
        throw new Error('All files failed to write. Check folder permissions.');
      }

      setResult({
        projectName: parsed.projectName,
        description: parsed.description,
        projectDir,
        fileCount: writeResults.filter(r => r.success).length,
        setupInstructions: parsed.setupInstructions,
      });

      addLog(`🎉 Project created! ${writeResults.filter(r => r.success).length} files written.`, 'success');
      setPhase('done');

    } catch (err) {
      setError(err.message);
      addLog(`❌ Error: ${err.message}`, 'error');
      setPhase('error');
    }
  };

  const openProject = async () => {
    if (!result) return;
    const tree = await window.electronAPI.readTree(result.projectDir);
    onProjectCreated?.(result.projectDir, tree);
    onClose();
  };

  const isBuilding = ['thinking', 'generating', 'writing'].includes(phase);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(10,10,15,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(12px)',
      }}
      onClick={e => { if (e.target === e.currentTarget && !isBuilding) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          width: '90%', maxWidth: 680,
          background: 'rgba(15,15,26,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.04))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏗</span> AI Project Builder
            </div>
            <div style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 2 }}>
              Describe what you want to build — CodeWhisper generates all the files
            </div>
          </div>
          {!isBuilding && (
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'rgba(241,245,249,0.4)',
              cursor: 'pointer', fontSize: 18, padding: 4,
            }}>✕</button>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {/* Template chips */}
          {phase === 'idle' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'rgba(241,245,249,0.35)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Quick templates
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TEMPLATES.map(t => (
                  <motion.button
                    key={t.label}
                    onClick={() => setPrompt(t.prompt)}
                    style={{
                      padding: '5px 12px', borderRadius: 100,
                      background: 'rgba(124,58,237,0.08)',
                      border: '1px solid rgba(124,58,237,0.2)',
                      color: '#a855f7', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                    }}
                    whileHover={{ background: 'rgba(124,58,237,0.15)', scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {t.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt input */}
          {phase === 'idle' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(241,245,249,0.5)', marginBottom: 6 }}>
                  Describe your project
                </div>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. Create a React todo app with dark theme, local storage, and smooth animations..."
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f1f5f9', fontSize: 13, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                    boxSizing: 'border-box', lineHeight: 1.6,
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.ctrlKey) build();
                  }}
                />
              </div>

              {/* Output folder */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(241,245,249,0.5)', marginBottom: 6 }}>
                  Output folder
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12, color: outputDir ? '#f1f5f9' : 'rgba(241,245,249,0.3)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {outputDir || 'No folder selected'}
                  </div>
                  <motion.button
                    onClick={pickOutputDir}
                    style={{
                      padding: '9px 14px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f1f5f9', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      whiteSpace: 'nowrap',
                    }}
                    whileHover={{ background: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.97 }}
                  >
                    📁 Browse
                  </motion.button>
                </div>
              </div>

              {error && (
                <div style={{
                  marginBottom: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                  fontSize: 12, color: '#f87171',
                }}>
                  {error}
                </div>
              )}

              <motion.button
                onClick={build}
                disabled={!prompt.trim() || !outputDir}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12,
                  background: prompt.trim() && outputDir
                    ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
                    : 'rgba(255,255,255,0.05)',
                  color: prompt.trim() && outputDir ? '#fff' : 'rgba(241,245,249,0.3)',
                  border: 'none', cursor: prompt.trim() && outputDir ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                  boxShadow: prompt.trim() && outputDir ? '0 0 30px rgba(124,58,237,0.4)' : 'none',
                }}
                whileHover={prompt.trim() && outputDir ? { scale: 1.02 } : {}}
                whileTap={prompt.trim() && outputDir ? { scale: 0.98 } : {}}
              >
                🏗 Build Project (5 credits)
              </motion.button>
            </>
          )}

          {/* Building state */}
          {isBuilding && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ fontSize: 40, marginBottom: 12, display: 'inline-block' }}
              >
                🪄
              </motion.div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                {phase === 'thinking' && 'Thinking...'}
                {phase === 'generating' && 'Generating your project...'}
                {phase === 'writing' && 'Writing files...'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)' }}>
                This may take 15–30 seconds
              </div>
            </div>
          )}

          {/* Log output */}
          {log.length > 0 && (
            <div style={{
              marginTop: 16,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 14px',
              maxHeight: 200, overflowY: 'auto',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {log.map((entry, i) => (
                <div key={i} style={{
                  fontSize: 11, marginBottom: 4,
                  color: entry.type === 'error' ? '#f87171'
                    : entry.type === 'success' ? '#10b981'
                    : 'rgba(241,245,249,0.6)',
                }}>
                  {entry.msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Done state */}
          {phase === 'done' && result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 16,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 14, padding: '20px',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', marginBottom: 6 }}>
                🎉 Project Ready!
              </div>
              <div style={{ fontSize: 13, color: 'rgba(241,245,249,0.7)', marginBottom: 4 }}>
                <strong style={{ color: '#f1f5f9' }}>{result.projectName}</strong> — {result.description}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(241,245,249,0.45)', marginBottom: 12 }}>
                {result.fileCount} files created at {result.projectDir}
              </div>
              {result.setupInstructions && (
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12, color: 'rgba(241,245,249,0.6)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 16,
                }}>
                  {result.setupInstructions}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button
                  onClick={openProject}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  📂 Open in CodeWhisper
                </motion.button>
                <motion.button
                  onClick={() => { setPhase('idle'); setLog([]); setResult(null); setPrompt(''); }}
                  style={{
                    padding: '11px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(241,245,249,0.6)', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                  whileHover={{ color: '#f1f5f9' }}
                >
                  Build Another
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {phase === 'error' && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <motion.button
                onClick={() => { setPhase('idle'); setError(''); }}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f1f5f9', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'inherit',
                }}
                whileHover={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Try Again
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
