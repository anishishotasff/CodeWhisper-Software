import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import CodeViewer from './components/CodeViewer';
import ChatPanel from './components/ChatPanel';
import Notepad from './components/Notepad';
import ProjectMap from './components/ProjectMap';
import AISettings from './components/AISettings';
import WelcomeScreen from './components/WelcomeScreen';
import AuthScreen from './components/AuthScreen';
import CreditsWidget from './components/CreditsWidget';
import ProjectBuilder from './components/ProjectBuilder';
import UpdateBanner from './components/UpdateBanner';
import SecretCodeModal, { isSecretUnlocked, getSecretApiKey } from './components/SecretCodeModal';
import { analyzeProject } from './utils/projectAnalyzer';
import { loadAISettings, PROVIDERS } from './utils/aiProvider';
import { loadCredits, setUserSession, clearUserSession } from './utils/creditsManager';

// ── Safety shim: if running in browser (not Electron), mock electronAPI ──────
if (!window.electronAPI) {
  window.electronAPI = {
    openFolder:          () => Promise.resolve(null),
    readTree:            () => Promise.resolve({ name: 'demo', path: '/', type: 'directory', children: [] }),
    readFile:            () => Promise.resolve({ content: '// Open in the desktop app to edit files', truncated: false }),
    writeFile:           () => Promise.resolve({ success: false, error: 'Not available in browser' }),
    writeFiles:          () => Promise.resolve([]),
    mkdir:               () => Promise.resolve({ success: false }),
    restoreBackup:       () => Promise.resolve({ success: false }),
    scanProject:         () => Promise.resolve([]),
    buildGraph:          () => Promise.resolve({ nodes: [], links: [] }),
    readPreviewBundle:   () => Promise.resolve({ html: '', success: false }),
    watchFolder:         () => Promise.resolve(true),
    notepadLoad:         () => Promise.resolve([]),
    notepadSave:         () => Promise.resolve({ success: true }),
    onFolderChanged:     () => {},
    onFileChanged:       () => {},
    onFileRenamed:       () => {},
    removeWatchListeners:() => {},
  };
}

export default function App() {
  const [projectPath, setProjectPath] = useState(null);
  const [tree, setTree] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [summary, setSummary] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(''); // 'scanning' | 'understanding' | ''
  const [showNotepad, setShowNotepad] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [liveReload, setLiveReload] = useState(null); // { path, timestamp } — flash indicator
  const [aiSettings, setAiSettings] = useState(loadAISettings);
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem('cw_welcomed') !== '1'
  );
  const [showAuth, setShowAuth] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [credits, setCredits] = useState(loadCredits);
  const [creditsTick, setCreditsTick] = useState(0); // force re-render on credit change

  // Derive apiKey — secret unlock overrides everything with the embedded key
  const secretKey = getSecretApiKey();
  const apiKey = secretKey
    ? secretKey
    : aiSettings.provider === PROVIDERS.OPENAI
      ? aiSettings.openaiKey
      : '__local__';

  // Keep refs so watcher callbacks always see latest values
  const selectedFileRef = useRef(selectedFile);
  const projectPathRef = useRef(projectPath);
  const reanalyzeTimer = useRef(null);

  useEffect(() => { selectedFileRef.current = selectedFile; }, [selectedFile]);
  useEffect(() => { projectPathRef.current = projectPath; }, [projectPath]);

  // ── Refresh credits display ───────────────────────────────────────────────
  const refreshCredits = useCallback(() => {
    setCredits(loadCredits());
    setCreditsTick(t => t + 1);
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuth = useCallback(({ uid, email, isNew }) => {
    const updated = setUserSession(uid, email, 'free');
    setCredits(updated);
    setShowAuth(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearUserSession();
    setCredits(loadCredits());
  }, []);

  // ── Listen for file-fixed events from CodeViewer ──────────────────────────
  useEffect(() => {
    const handler = async (e) => {
      const { path: filePath, content } = e.detail;
      if (content) {
        setFileContent(content);
      } else if (filePath) {
        const result = await window.electronAPI.readFile(filePath);
        setFileContent(result.content);
      }
    };
    window.addEventListener('codewhisper:fileFixed', handler);
    return () => window.removeEventListener('codewhisper:fileFixed', handler);
  }, []);

  // ── Setup all watchers after folder is opened ─────────────────────────────
  const setupWatchers = useCallback((folderPath) => {
    window.electronAPI.removeWatchListeners();

    // 1. Folder structure changed → refresh sidebar tree
    window.electronAPI.onFolderChanged(async () => {
      const updated = await window.electronAPI.readTree(folderPath);
      setTree(updated);
    });

    // 2. A specific file changed externally → auto-reload if it's open
    window.electronAPI.onFileChanged(async (data) => {
      const current = selectedFileRef.current;
      if (current && current.path === data.path) {
        // Update content live
        setFileContent(data.content);
        setLiveReload({ path: data.path, timestamp: Date.now() });

        // Debounced re-analyze: wait 2s after last change before re-scanning
        clearTimeout(reanalyzeTimer.current);
        reanalyzeTimer.current = setTimeout(async () => {
          const proj = projectPathRef.current;
          if (proj) {
            const files = await window.electronAPI.scanProject(proj);
            const result = analyzeProject(proj, files);
            setSummary(result);
          }
        }, 2000);
      }
    });

    // 3. File created/deleted → refresh tree
    window.electronAPI.onFileRenamed(async () => {
      const updated = await window.electronAPI.readTree(folderPath);
      setTree(updated);
    });
  }, []);

  // ── Open a folder ─────────────────────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    // Guard: electronAPI.openFolder returns null in browser mode
    setOpening(true);
    setLoadingPhase('scanning');
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) return; // user cancelled or browser mode
      setLoadingPhase('understanding');
      const treeData = await window.electronAPI.readTree(folderPath);
      setProjectPath(folderPath);
      setTree(treeData);
      setSelectedFile(null);
      setFileContent('');
      setSummary('');
      await window.electronAPI.watchFolder(folderPath);
      setupWatchers(folderPath);
    } finally {
      setOpening(false);
      setLoadingPhase('');
    }
  }, [setupWatchers]);

  // ── Select a file ─────────────────────────────────────────────────────────
  const handleSelectFile = useCallback(async (node) => {
    if (node.type !== 'file') return;
    setSelectedFile(node);
    setLiveReload(null);
    const result = await window.electronAPI.readFile(node.path);
    setFileContent(result.content);
  }, []);

  // ── Analyze project ───────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!projectPath) return;
    setAnalyzing(true);
    try {
      const files = await window.electronAPI.scanProject(projectPath);
      const result = analyzeProject(projectPath, files);
      setSummary(result);
    } finally {
      setAnalyzing(false);
    }
  }, [projectPath]);

  // ── Pin file to notepad ───────────────────────────────────────────────────
  const handlePinToNotepad = useCallback((filePath, content) => {
    setShowNotepad(true);
    window.dispatchEvent(new CustomEvent('codewhisper:pinFile', { detail: { filePath, content } }));
  }, []);

  // Flash indicator fades after 2s
  useEffect(() => {
    if (!liveReload) return;
    const t = setTimeout(() => setLiveReload(null), 2000);
    return () => clearTimeout(t);
  }, [liveReload]);

  return (
    <div className="app">
      {/* ── Update banner ── */}
      <UpdateBanner />

      {/* ── Header ── */}
      <motion.header
        className="app-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <motion.span
          className="app-title"
          whileHover={{ scale: 1.04 }}
          transition={{ duration: 0.15 }}
        >
          🪄 CodeWhisper
        </motion.span>

        <motion.button
          className="btn btn-primary"
          onClick={handleOpenFolder}
          disabled={opening}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
        >
          {opening ? <><span className="spinner" /> {loadingPhase === 'scanning' ? 'Scanning files...' : 'Understanding...'}</> : '📂 Open Project'}
        </motion.button>

        <motion.button
          className="btn btn-secondary"
          onClick={() => setShowBuilder(true)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(124,58,237,0.3)', color: '#a855f7' }}
        >
          🏗 Build
        </motion.button>

        {projectPath && (
          <motion.button
            className="btn btn-secondary"
            onClick={handleAnalyze}
            disabled={analyzing}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.12 }}
          >
            {analyzing ? <><span className="spinner" /> Analyzing...</> : '🔍 Analyze'}
          </motion.button>
        )}

        <motion.button
          className={`btn ${showNotepad ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowNotepad(v => !v)}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
        >
          📝 Notepad
        </motion.button>

        {projectPath && (
          <motion.button
            className={`btn ${showMap ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowMap(v => !v)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.12 }}
          >
            🗺 Map
          </motion.button>
        )}

        {projectPath && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}
          >
            {projectPath}
          </motion.span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AnimatePresence>
            {liveReload && (
              <motion.span
                className="live-badge"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                🔴 Live
              </motion.span>
            )}
          </AnimatePresence>

          {projectPath && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontSize: 10, color: 'var(--success)', padding: '2px 6px', background: 'rgba(78,201,176,0.08)', borderRadius: 3 }}
            >
              👁 Watching
            </motion.span>
          )}

          <motion.button
            className={`ai-mode-btn ${aiSettings.provider === PROVIDERS.OLLAMA ? 'local' : 'cloud'}`}
            onClick={() => setShowAISettings(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            transition={{ duration: 0.12 }}
          >
            {aiSettings.provider === PROVIDERS.OLLAMA ? (
              <><span>🔒</span> Local AI</>
            ) : apiKey ? (
              <><span>☁️</span> OpenAI</>
            ) : (
              <><span>⚠️</span> No AI Key</>
            )}
          </motion.button>

          {/* Credits widget */}
          <CreditsWidget
            key={creditsTick}
            onLogout={handleLogout}
            onRefresh={refreshCredits}
          />

          {/* Sign in button if not logged in */}
          {!credits.email && (
            <motion.button
              className="btn btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setShowAuth(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
            >
              Sign In
            </motion.button>
          )}

          {/* Secret unlock button — subtle, no label */}
          <motion.button
            onClick={() => setShowSecretModal(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, opacity: isSecretUnlocked() ? 0.9 : 0.25,
              padding: '2px 4px', color: isSecretUnlocked() ? '#a855f7' : 'var(--text-muted)',
              transition: 'opacity 0.2s',
            }}
            whileHover={{ opacity: 1, scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title={isSecretUnlocked() ? '⭐ Premium Active' : ''}
          >
            {isSecretUnlocked() ? '⭐' : '🔐'}
          </motion.button>
        </div>
      </motion.header>

      {/* ── Project loading overlay ── */}
      <AnimatePresence>
        {opening && (
          <motion.div
            className="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="loading-card"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <motion.div
                className="loading-icon"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                🪄
              </motion.div>
              <motion.div
                className="loading-text"
                key={loadingPhase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {loadingPhase === 'scanning' ? 'Scanning files...' : 'Understanding project...'}
              </motion.div>
              <div className="loading-bar-track">
                <motion.div
                  className="loading-bar-fill"
                  initial={{ width: '0%' }}
                  animate={{ width: loadingPhase === 'understanding' ? '85%' : '40%' }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Body ── */}
      <motion.div
        className="app-body"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Sidebar tree={tree} selectedFile={selectedFile} onSelectFile={handleSelectFile} />

        <CodeViewer
          selectedFile={selectedFile}
          content={fileContent}
          summary={summary}
          analyzing={analyzing}
          onPinToNotepad={handlePinToNotepad}
          apiKey={apiKey}
          aiSettings={aiSettings}
          liveReload={liveReload}
          onCreditUsed={refreshCredits}
        />

        <ChatPanel
          selectedFile={selectedFile}
          fileContent={fileContent}
          summary={summary}
          projectPath={projectPath}
          aiSettings={aiSettings}
          apiKey={apiKey}
          onApiKeyChange={(key) => setAiSettings(prev => ({ ...prev, openaiKey: key }))}
          onCreditUsed={refreshCredits}
        />
      </motion.div>

      <AnimatePresence>
        {showNotepad && (
          <motion.div
            key="notepad"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Notepad
              onClose={() => setShowNotepad(false)}
              apiKey={apiKey}
              aiSettings={aiSettings}
              selectedFile={selectedFile}
              fileContent={fileContent}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAISettings && (
          <motion.div
            key="aisettings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AISettings
              onClose={() => setShowAISettings(false)}
              onSave={(s) => setAiSettings(s)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMap && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <ProjectMap
              projectPath={projectPath}
              onClose={() => setShowMap(false)}
              onSelectFile={(node) => {
                setShowMap(false);
                handleSelectFile(node);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Secret code modal ── */}
      <AnimatePresence>
        {showSecretModal && (
          <SecretCodeModal
            onClose={() => setShowSecretModal(false)}
            onUnlock={() => {
              refreshCredits();
              setAiSettings(prev => ({ ...prev, provider: PROVIDERS.OPENAI }));
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Auth screen ── */}
      <AnimatePresence>
        {showAuth && (
          <AuthScreen
            onAuth={handleAuth}
            onSkip={() => setShowAuth(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Project Builder ── */}
      <AnimatePresence>
        {showBuilder && (
          <ProjectBuilder
            apiKey={apiKey}
            aiSettings={aiSettings}
            onProjectCreated={async (folderPath, tree) => {
              setProjectPath(folderPath);
              setTree(tree);
              setSelectedFile(null);
              setFileContent('');
              setSummary('');
              await window.electronAPI.watchFolder(folderPath);
              setupWatchers(folderPath);
              refreshCredits();
            }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Welcome screen — first run only ── */}
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen
            onComplete={() => {
              setShowWelcome(false);
              setAiSettings(loadAISettings());
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
