// ── Extensions Engine ─────────────────────────────────────────────────────────
// Makes installed extensions actually do things

function getInstalled() {
  try { return JSON.parse(localStorage.getItem('cw_extensions') || '[]'); } catch { return []; }
}

export function isInstalled(id) {
  return getInstalled().includes(id);
}

// ── Prettier: Format code ─────────────────────────────────────────────────────
export async function formatWithPrettier(code, ext) {
  if (!isInstalled('prettier')) return null;
  try {
    const prettier = await import('prettier/standalone');
    const parserMap = {
      '.js': 'babel', '.jsx': 'babel', '.ts': 'typescript', '.tsx': 'typescript',
      '.css': 'css', '.scss': 'css', '.json': 'json', '.md': 'markdown',
      '.html': 'html', '.yaml': 'yaml', '.yml': 'yaml',
    };
    const parser = parserMap[ext];
    if (!parser) return null;

    let plugins = [];
    if (parser === 'babel') plugins = [(await import('prettier/plugins/babel')).default, (await import('prettier/plugins/estree')).default];
    else if (parser === 'typescript') plugins = [(await import('prettier/plugins/typescript')).default, (await import('prettier/plugins/estree')).default];
    else if (parser === 'css') plugins = [(await import('prettier/plugins/postcss')).default];
    else if (parser === 'json') plugins = [(await import('prettier/plugins/babel')).default, (await import('prettier/plugins/estree')).default];
    else if (parser === 'markdown') plugins = [(await import('prettier/plugins/markdown')).default];
    else if (parser === 'html') plugins = [(await import('prettier/plugins/html')).default];
    else if (parser === 'yaml') plugins = [(await import('prettier/plugins/yaml')).default];

    const formatted = await prettier.format(code, {
      parser,
      plugins,
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      trailingComma: 'es5',
      printWidth: 100,
    });
    return formatted;
  } catch (err) {
    console.warn('Prettier error:', err.message);
    return null;
  }
}

// ── TODO Highlight: Find all TODOs ────────────────────────────────────────────
export function findTodos(code, filename) {
  if (!isInstalled('todo-highlight')) return [];
  const patterns = [
    { regex: /\/\/\s*(TODO|FIXME|HACK|NOTE|BUG|XXX)[:\s]*(.*)/gi, type: 'comment' },
    { regex: /#\s*(TODO|FIXME|HACK|NOTE|BUG)[:\s]*(.*)/gi, type: 'comment' },
  ];
  const todos = [];
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    patterns.forEach(({ regex }) => {
      regex.lastIndex = 0;
      const match = regex.exec(line);
      if (match) {
        todos.push({
          line: i + 1,
          type: match[1].toUpperCase(),
          text: match[2].trim() || line.trim(),
          color: match[1] === 'FIXME' || match[1] === 'BUG' ? '#f87171'
            : match[1] === 'HACK' ? '#f59e0b'
            : '#60a5fa',
        });
      }
    });
  });
  return todos;
}

// ── Error Lens: Inline error annotations ─────────────────────────────────────
export function getErrorLensAnnotations(code, ext) {
  if (!isInstalled('error-lens')) return [];
  const annotations = [];
  const lines = code.split('\n');

  lines.forEach((line, i) => {
    // Detect common patterns
    if (/console\.log\(/.test(line) && isInstalled('eslint')) {
      annotations.push({ line: i + 1, type: 'warning', message: 'Unexpected console statement' });
    }
    if (/var\s+\w+/.test(line) && (ext === '.js' || ext === '.ts')) {
      annotations.push({ line: i + 1, type: 'warning', message: 'Use const or let instead of var' });
    }
    if (/==\s/.test(line) && !/===/.test(line) && (ext === '.js' || ext === '.ts')) {
      annotations.push({ line: i + 1, type: 'warning', message: 'Use === instead of ==' });
    }
  });
  return annotations;
}

// ── Bracket Colorizer: Get bracket pairs ─────────────────────────────────────
export function getBracketColors() {
  if (!isInstalled('bracket-colorizer')) return null;
  return ['#ffd700', '#da70d6', '#87ceeb']; // gold, orchid, skyblue
}

// ── Indent Rainbow: Get indent color for a line ───────────────────────────────
export function getIndentColor(line) {
  if (!isInstalled('indent-rainbow')) return null;
  const indent = line.match(/^(\s+)/)?.[1]?.length || 0;
  if (indent === 0) return null;
  const colors = ['rgba(255,99,99,0.15)', 'rgba(255,165,0,0.15)', 'rgba(255,255,0,0.15)', 'rgba(0,255,0,0.15)', 'rgba(0,150,255,0.15)', 'rgba(150,0,255,0.15)'];
  const level = Math.floor(indent / 2) % colors.length;
  return colors[level];
}

// ── WakaTime: Track coding time ───────────────────────────────────────────────
let wakaSession = { start: Date.now(), file: null, totalMs: 0 };

export function trackWakaTime(filename) {
  if (!isInstalled('wakatime')) return;
  if (wakaSession.file !== filename) {
    if (wakaSession.file) {
      wakaSession.totalMs += Date.now() - wakaSession.start;
    }
    wakaSession.file = filename;
    wakaSession.start = Date.now();
  }
}

export function getWakaStats() {
  if (!isInstalled('wakatime')) return null;
  const total = wakaSession.totalMs + (Date.now() - wakaSession.start);
  const mins = Math.floor(total / 60000);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}
