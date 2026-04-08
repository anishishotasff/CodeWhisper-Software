// ── Theme Manager ─────────────────────────────────────────────────────────────

export const THEMES = {
  'vscode-dark': {
    name: 'VS Code Dark',
    icon: '🖤',
    vars: {
      '--bg-primary':   '#1e1e1e',
      '--bg-secondary': '#252526',
      '--bg-tertiary':  '#2d2d30',
      '--bg-hover':     '#2a2d2e',
      '--border':       '#3e3e42',
      '--accent':       '#007acc',
      '--accent-hover': '#1a8ad4',
      '--text-primary': '#d4d4d4',
      '--text-muted':   '#858585',
      '--text-dim':     '#6a6a6a',
      '--success':      '#4ec9b0',
      '--warning':      '#dcdcaa',
      '--error':        '#f44747',
    },
  },
  'one-dark-pro': {
    name: 'One Dark Pro',
    icon: '🌑',
    vars: {
      '--bg-primary':   '#282c34',
      '--bg-secondary': '#21252b',
      '--bg-tertiary':  '#2c313c',
      '--bg-hover':     '#2c313a',
      '--border':       '#181a1f',
      '--accent':       '#61afef',
      '--accent-hover': '#528bff',
      '--text-primary': '#abb2bf',
      '--text-muted':   '#5c6370',
      '--text-dim':     '#4b5263',
      '--success':      '#98c379',
      '--warning':      '#e5c07b',
      '--error':        '#e06c75',
    },
  },
  'dracula': {
    name: 'Dracula',
    icon: '🧛',
    vars: {
      '--bg-primary':   '#282a36',
      '--bg-secondary': '#1e1f29',
      '--bg-tertiary':  '#343746',
      '--bg-hover':     '#44475a',
      '--border':       '#44475a',
      '--accent':       '#bd93f9',
      '--accent-hover': '#ff79c6',
      '--text-primary': '#f8f8f2',
      '--text-muted':   '#6272a4',
      '--text-dim':     '#44475a',
      '--success':      '#50fa7b',
      '--warning':      '#f1fa8c',
      '--error':        '#ff5555',
    },
  },
  'monokai': {
    name: 'Monokai',
    icon: '🟡',
    vars: {
      '--bg-primary':   '#272822',
      '--bg-secondary': '#1e1f1c',
      '--bg-tertiary':  '#3e3d32',
      '--bg-hover':     '#3e3d32',
      '--border':       '#49483e',
      '--accent':       '#a6e22e',
      '--accent-hover': '#e6db74',
      '--text-primary': '#f8f8f2',
      '--text-muted':   '#75715e',
      '--text-dim':     '#49483e',
      '--success':      '#a6e22e',
      '--warning':      '#e6db74',
      '--error':        '#f92672',
    },
  },
  'solarized-dark': {
    name: 'Solarized Dark',
    icon: '☀️',
    vars: {
      '--bg-primary':   '#002b36',
      '--bg-secondary': '#073642',
      '--bg-tertiary':  '#094555',
      '--bg-hover':     '#0a4f61',
      '--border':       '#094555',
      '--accent':       '#268bd2',
      '--accent-hover': '#2aa198',
      '--text-primary': '#839496',
      '--text-muted':   '#586e75',
      '--text-dim':     '#073642',
      '--success':      '#859900',
      '--warning':      '#b58900',
      '--error':        '#dc322f',
    },
  },
  'nord': {
    name: 'Nord',
    icon: '❄️',
    vars: {
      '--bg-primary':   '#2e3440',
      '--bg-secondary': '#3b4252',
      '--bg-tertiary':  '#434c5e',
      '--bg-hover':     '#4c566a',
      '--border':       '#4c566a',
      '--accent':       '#88c0d0',
      '--accent-hover': '#81a1c1',
      '--text-primary': '#eceff4',
      '--text-muted':   '#d8dee9',
      '--text-dim':     '#4c566a',
      '--success':      '#a3be8c',
      '--warning':      '#ebcb8b',
      '--error':        '#bf616a',
    },
  },
  'github-dark': {
    name: 'GitHub Dark',
    icon: '🐙',
    vars: {
      '--bg-primary':   '#0d1117',
      '--bg-secondary': '#161b22',
      '--bg-tertiary':  '#21262d',
      '--bg-hover':     '#30363d',
      '--border':       '#30363d',
      '--accent':       '#58a6ff',
      '--accent-hover': '#79c0ff',
      '--text-primary': '#c9d1d9',
      '--text-muted':   '#8b949e',
      '--text-dim':     '#484f58',
      '--success':      '#3fb950',
      '--warning':      '#d29922',
      '--error':        '#f85149',
    },
  },
  'cyberpunk': {
    name: 'Cyberpunk',
    icon: '🌆',
    vars: {
      '--bg-primary':   '#0a0a0f',
      '--bg-secondary': '#0f0f1a',
      '--bg-tertiary':  '#14142a',
      '--bg-hover':     '#1a1a35',
      '--border':       '#2a2a4a',
      '--accent':       '#ff2d78',
      '--accent-hover': '#00f5ff',
      '--text-primary': '#e0e0ff',
      '--text-muted':   '#7070a0',
      '--text-dim':     '#3a3a6a',
      '--success':      '#00ff9f',
      '--warning':      '#ffcc00',
      '--error':        '#ff2d78',
    },
  },
  'forest': {
    name: 'Forest',
    icon: '🌲',
    vars: {
      '--bg-primary':   '#1a2318',
      '--bg-secondary': '#1f2b1d',
      '--bg-tertiary':  '#263323',
      '--bg-hover':     '#2d3d2a',
      '--border':       '#3a4f36',
      '--accent':       '#7ec850',
      '--accent-hover': '#a0e070',
      '--text-primary': '#d4e8c8',
      '--text-muted':   '#7a9a6a',
      '--text-dim':     '#4a6a3a',
      '--success':      '#7ec850',
      '--warning':      '#e8c84a',
      '--error':        '#e85050',
    },
  },
  'midnight-blue': {
    name: 'Midnight Blue',
    icon: '🌙',
    vars: {
      '--bg-primary':   '#0a0e1a',
      '--bg-secondary': '#0f1525',
      '--bg-tertiary':  '#141c30',
      '--bg-hover':     '#1a2540',
      '--border':       '#1e2d4a',
      '--accent':       '#4d9fff',
      '--accent-hover': '#7ab8ff',
      '--text-primary': '#c8d8f0',
      '--text-muted':   '#5a7090',
      '--text-dim':     '#2a3a55',
      '--success':      '#4dffb4',
      '--warning':      '#ffd04d',
      '--error':        '#ff4d6a',
    },
  },
};

export function applyTheme(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  localStorage.setItem('cw_theme', themeId);
}

export function loadTheme() {
  const saved = localStorage.getItem('cw_theme') || 'vscode-dark';
  applyTheme(saved);
  return saved;
}

export function getCurrentTheme() {
  return localStorage.getItem('cw_theme') || 'vscode-dark';
}
