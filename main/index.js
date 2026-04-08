const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Reliable dev detection: check if running from source (not packaged)
// app.isPackaged is false in dev, true in production build
function getIsDev() {
  // If explicitly set via env var, use that
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.NODE_ENV === 'production') return false;
  // Fall back to checking if app is packaged
  return !app.isPackaged;
}

// Path to store notepad data
const NOTEPAD_FILE = path.join(app.getPath('userData'), 'codewhisper-notepad.json');

// Watcher declared at top so createWindow can reference it
let watcher = null;
let watchDebounceMap = {};

function createWindow() {
  const isDev = getIsDev();

  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#1e1e1e',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000').catch(err => {
      console.error('Failed to load dev server:', err.message);
      // Retry after 2s if dev server isn't ready yet
      setTimeout(() => win.loadURL('http://localhost:3000'), 2000);
    });
    // Open DevTools in dev mode (comment out if not needed)
    // win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../renderer/build/index.html');
    if (fs.existsSync(indexPath)) {
      win.loadFile(indexPath);
    } else {
      win.loadURL('http://localhost:3000');
    }
  }

  // Prevent white flash
  win.once('ready-to-show', () => win.show());

  win.on('closed', () => {
    // Cleanup watcher on window close
    if (watcher) { watcher.close(); watcher = null; }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Prevent crash on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// ── IPC: Create directory ────────────────────────────────────────────────────
ipcMain.handle('fs:mkdir', async (_, dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Write multiple files (for project builder) ──────────────────────────
ipcMain.handle('fs:writeFiles', async (_, files) => {
  // files: [{ path, content }]
  const results = [];
  for (const file of files) {
    try {
      fs.mkdirSync(path.dirname(file.path), { recursive: true });
      fs.writeFileSync(file.path, file.content, 'utf-8');
      results.push({ path: file.path, success: true });
    } catch (err) {
      results.push({ path: file.path, success: false, error: err.message });
    }
  }
  return results;
});

// ── IPC: Open folder dialog ──────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ── IPC: Read directory tree ─────────────────────────────────────────────────
ipcMain.handle('fs:readTree', async (_, folderPath) => {
  return buildTree(folderPath);
});

function buildTree(dirPath) {
  const name = path.basename(dirPath);
  try {
    const stat = fs.statSync(dirPath);
    if (stat.isFile()) {
      return { name, path: dirPath, type: 'file', size: stat.size, ext: path.extname(name).toLowerCase() };
    }
    const children = fs.readdirSync(dirPath)
      .filter(n => !n.startsWith('.') && n !== 'node_modules' && n !== '__pycache__' && n !== 'dist' && n !== '.git')
      .map(child => buildTree(path.join(dirPath, child)))
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    return { name, path: dirPath, type: 'directory', children };
  } catch {
    return { name, path: dirPath, type: 'file', size: 0, ext: '' };
  }
}

// ── IPC: Read file content ───────────────────────────────────────────────────
ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 512000) return { content: '// File too large to display (>500KB)', truncated: true };
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, truncated: false };
  } catch (err) {
    return { content: `// Error reading file: ${err.message}`, truncated: false };
  }
});

// ── IPC: Read multiple files for live preview (HTML + linked CSS/JS) ─────────
ipcMain.handle('fs:readPreviewBundle', async (_, htmlPath) => {
  try {
    const dir = path.dirname(htmlPath);
    const html = fs.readFileSync(htmlPath, 'utf-8');

    // Inline linked CSS and JS so iframe can render without file:// restrictions
    let inlined = html;

    // Inline <link rel="stylesheet" href="...">
    inlined = inlined.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (match, href) => {
      if (href.startsWith('http')) return match;
      try {
        const cssPath = path.resolve(dir, href);
        const css = fs.readFileSync(cssPath, 'utf-8');
        return `<style>/* inlined: ${href} */\n${css}</style>`;
      } catch { return match; }
    });

    // Inline <script src="...">
    inlined = inlined.replace(/<script([^>]*)\ssrc=["']([^"']+)["']([^>]*)><\/script>/gi, (match, pre, src, post) => {
      if (src.startsWith('http')) return match;
      try {
        const jsPath = path.resolve(dir, src);
        const js = fs.readFileSync(jsPath, 'utf-8');
        return `<script${pre}${post}>/* inlined: ${src} */\n${js}</script>`;
      } catch { return match; }
    });

    return { html: inlined, success: true };
  } catch (err) {
    return { html: `<pre style="color:red">Error: ${err.message}</pre>`, success: false };
  }
});

// ── IPC: Write file content (for error fixing) ───────────────────────────────
ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try {
    // Backup original
    const backupPath = filePath + '.codemind.bak';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Restore backup ──────────────────────────────────────────────────────
ipcMain.handle('fs:restoreBackup', async (_, filePath) => {
  try {
    const backupPath = filePath + '.codemind.bak';
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      return { success: true };
    }
    return { success: false, error: 'No backup found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Scan project for summary ───────────────────────────────────────────
ipcMain.handle('fs:scanProject', async (_, folderPath) => {
  const files = [];
  collectFiles(folderPath, files, 0);
  return files;
});

function collectFiles(dirPath, result, depth) {
  if (depth > 5) return;
  try {
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === '__pycache__' || entry === 'dist') continue;
      const full = path.join(dirPath, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        collectFiles(full, result, depth + 1);
      } else {
        result.push({ path: full, name: entry, size: stat.size, ext: path.extname(entry).toLowerCase() });
      }
    }
  } catch {}
}

// ── IPC: Build project dependency graph ─────────────────────────────────────
ipcMain.handle('fs:buildGraph', async (_, folderPath) => {
  const files = [];
  collectFiles(folderPath, files, 0);

  const nodes = [];
  const links = [];
  const nodeMap = {}; // filePath → index

  // Only include code files
  const CODE_EXTS = new Set([
    '.js','.jsx','.mjs','.ts','.tsx',
    '.py','.go','.rs','.java','.cs',
    '.cpp','.cc','.cxx','.c','.h','.hpp',
    '.rb','.php','.swift','.kt','.kts',
    '.vue','.svelte','.html','.htm',
    '.sh','.bash','.zsh',
    '.css','.scss','.less','.sass',
  ]);
  const codeFiles = files.filter(f => CODE_EXTS.has(f.ext));

  // Build node list
  codeFiles.forEach((f, i) => {
    const rel = f.path.replace(folderPath, '').replace(/\\/g, '/').replace(/^\//, '');
    nodes.push({ id: f.path, label: f.name, rel, ext: f.ext, size: f.size, group: getGroup(f.ext) });
    nodeMap[f.path] = i;
  });

  // Parse imports/requires from each file to build edges
  const importPatterns = [
    // JS/TS: import ... from '...'
    /import\s+(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
    // JS: require('...')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Python: from . import / import .
    /from\s+['"]?([./][\w./]+)['"]?\s+import/g,
    // Go: import "..."
    /import\s+["']([^"']+)["']/g,
  ];

  for (const file of codeFiles) {
    try {
      if (file.size > 200000) continue;
      const content = fs.readFileSync(file.path, 'utf-8');
      const dir = path.dirname(file.path);
      const seen = new Set();

      for (const pattern of importPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          // Only resolve relative imports
          if (!importPath.startsWith('.')) continue;

          // Try resolving with common extensions
          const extsToTry = ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.ts'];
          for (const ext of extsToTry) {
            const resolved = path.resolve(dir, importPath + ext);
            if (nodeMap[resolved] !== undefined && !seen.has(resolved)) {
              seen.add(resolved);
              links.push({ source: file.path, target: resolved });
              break;
            }
          }
        }
      }

      // Also extract exported function names for tooltip
      const fnMatches = content.match(/(?:export\s+)?(?:function|const|class)\s+(\w+)/g) || [];
      const fns = fnMatches.slice(0, 8).map(m => m.replace(/(?:export\s+)?(?:function|const|class)\s+/, ''));
      const nodeIdx = nodeMap[file.path];
      if (nodeIdx !== undefined) nodes[nodeIdx].functions = fns;

    } catch {}
  }

  return { nodes, links };
});

function getGroup(ext) {
  if (['.js', '.jsx', '.mjs'].includes(ext))          return 'js';
  if (['.ts', '.tsx'].includes(ext))                   return 'ts';
  if (ext === '.py')                                   return 'py';
  if (ext === '.go')                                   return 'go';
  if (ext === '.rs')                                   return 'rs';
  if (['.css', '.scss', '.less', '.sass'].includes(ext)) return 'style';
  if (['.java', '.kt', '.kts'].includes(ext))          return 'java';
  if (['.rb', '.erb'].includes(ext))                   return 'ruby';
  if (['.php'].includes(ext))                          return 'php';
  if (['.cs'].includes(ext))                           return 'cs';
  if (['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'].includes(ext)) return 'cpp';
  if (['.swift'].includes(ext))                        return 'swift';
  if (['.vue'].includes(ext))                          return 'vue';
  if (['.svelte'].includes(ext))                       return 'svelte';
  if (['.html', '.htm'].includes(ext))                 return 'html';
  if (['.sh', '.bash', '.zsh'].includes(ext))          return 'shell';
  return 'other';
}

// ── IPC: Notepad persistence ─────────────────────────────────────────────────
ipcMain.handle('notepad:load', async () => {
  try {
    if (fs.existsSync(NOTEPAD_FILE)) {
      return JSON.parse(fs.readFileSync(NOTEPAD_FILE, 'utf-8'));
    }
    return [];
  } catch { return []; }
});

ipcMain.handle('notepad:save', async (_, notes) => {
  try {
    fs.writeFileSync(NOTEPAD_FILE, JSON.stringify(notes, null, 2), 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── IPC: Watch folder for changes ───────────────────────────────────────────

ipcMain.handle('fs:watchFolder', async (event, folderPath) => {
  if (watcher) { watcher.close(); watcher = null; }
  watchDebounceMap = {};

  watcher = fs.watch(folderPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;

    // Ignore backup files, node_modules, .git, hidden files
    if (
      filename.includes('node_modules') ||
      filename.includes('.git') ||
      filename.endsWith('.bak') ||
      filename.startsWith('.')
    ) return;

    const fullPath = path.join(folderPath, filename);
    const key = fullPath;

    // Debounce per file — 300ms to avoid duplicate rapid events
    clearTimeout(watchDebounceMap[key]);
    watchDebounceMap[key] = setTimeout(() => {
      try {
        const exists = fs.existsSync(fullPath);
        const isFile = exists && fs.statSync(fullPath).isFile();

        // Send tree refresh event (for sidebar)
        event.sender.send('fs:folderChanged', { eventType, filename, fullPath });

        // If it's a file change, also send file-specific event with new content
        if (isFile && eventType === 'change') {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size < 512000) {
              const content = fs.readFileSync(fullPath, 'utf-8');
              event.sender.send('fs:fileChanged', {
                path: fullPath,
                content,
                size: stat.size,
                ext: path.extname(fullPath).toLowerCase(),
              });
            }
          } catch {}
        }

        // If file was created or deleted, send structural event
        if (eventType === 'rename') {
          event.sender.send('fs:fileRenamed', {
            path: fullPath,
            exists,
            filename,
          });
        }
      } catch {}
    }, 300);
  });

  return true;
});
