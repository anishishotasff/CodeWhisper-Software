import React, { useState, useEffect, useRef, useCallback } from 'react';

const PREVIEW_TYPES = {
  html:     ['.html', '.htm'],
  css:      ['.css', '.scss'],
  markdown: ['.md', '.markdown'],
  json:     ['.json'],
  svg:      ['.svg'],
};

export function canPreview(ext) {
  return Object.values(PREVIEW_TYPES).flat().includes(ext);
}

function getPreviewType(ext) {
  for (const [type, exts] of Object.entries(PREVIEW_TYPES)) {
    if (exts.includes(ext)) return type;
  }
  return null;
}

// ── Renderers ────────────────────────────────────────────────────────────────

function cssToHtml(css) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { background:#fff; padding:24px; font-family:system-ui,sans-serif; margin:0; }
</style>
<style>${css}</style>
</head><body>
<div style="background:#f5f5f5;padding:8px 12px;border-radius:4px;margin-bottom:20px;font-size:11px;color:#888;font-family:monospace">
  CSS Preview — sample elements below
</div>
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<h3>Heading 3</h3>
<p>Paragraph with <strong>bold</strong>, <em>italic</em>, and <a href="#">a link</a>.</p>
<button class="btn">Button</button>
<button>Default Button</button>
<ul><li>List item one</li><li>List item two</li><li>List item three</li></ul>
<input type="text" placeholder="Text input" style="display:block;margin:8px 0;padding:6px 10px;border:1px solid #ccc;border-radius:4px;width:200px">
<div class="card" style="margin-top:16px">
  <div class="container"><div class="box">Box element</div></div>
</div>
</body></html>`;
}

function renderMarkdown(md) {
  // Escape HTML first
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must come before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code.trimEnd()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold / italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquote
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // HR
  html = html.replace(/^---+$/gm, '<hr>');

  // Images before links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Unordered lists
  html = html.replace(/((?:^[-*+]\s.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*+]\s/, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\.\s.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs — wrap lines not already wrapped in a block tag
  html = html.replace(/^(?!<[hupobdtia]|$)(.+)$/gm, '<p>$1</p>');

  return html;
}

function markdownToHtml(md) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:0 auto;padding:32px 24px;line-height:1.75;color:#1a1a1a;background:#fff}
  h1{font-size:2em;border-bottom:2px solid #eee;padding-bottom:10px;margin-top:0}
  h2{font-size:1.5em;border-bottom:1px solid #eee;padding-bottom:6px}
  h3{font-size:1.2em}
  code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:'Fira Code',monospace;font-size:.88em;color:#d63384}
  pre{background:#f3f4f6;padding:16px;border-radius:8px;overflow-x:auto;border:1px solid #e5e7eb}
  pre code{background:none;padding:0;color:#1a1a1a;font-size:.9em}
  blockquote{border-left:4px solid #6366f1;margin:0;padding:4px 16px;color:#555;background:#f8f8ff;border-radius:0 6px 6px 0}
  a{color:#6366f1;text-decoration:none}a:hover{text-decoration:underline}
  img{max-width:100%;border-radius:6px}
  ul,ol{padding-left:28px}
  li{margin:4px 0}
  hr{border:none;border-top:2px solid #eee;margin:28px 0}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #ddd;padding:8px 12px}
  th{background:#f3f4f6;font-weight:600}
</style>
</head><body>${renderMarkdown(md)}</body></html>`;
}

function jsonToHtml(json) {
  let pretty = json;
  try { pretty = JSON.stringify(JSON.parse(json), null, 2); } catch {}

  const highlighted = pretty
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'num';
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'key' : 'str';
        else if (/true|false/.test(match)) cls = 'bool';
        else if (/null/.test(match)) cls = 'null';
        return `<span class="${cls}">${match}</span>`;
      }
    );

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body{background:#1e1e1e;color:#d4d4d4;font-family:'Fira Code',Consolas,monospace;font-size:13px;padding:20px;margin:0;line-height:1.6}
  pre{margin:0;white-space:pre-wrap;word-break:break-all}
  .key{color:#9cdcfe}.str{color:#ce9178}.num{color:#b5cea8}.bool{color:#569cd6}.null{color:#569cd6}
</style>
</head><body><pre>${highlighted}</pre></body></html>`;
}

function svgToHtml(svg) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body{margin:0;background:#1e1e1e;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;box-sizing:border-box}
  svg{max-width:100%;max-height:90vh}
</style>
</head><body>${svg}</body></html>`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LivePreview({ selectedFile, content, editContent, isEditing }) {
  const iframeRef   = useRef(null);
  const blobUrlRef  = useRef(null); // track current blob URL to revoke it
  const updateTimer = useRef(null);

  const [device, setDevice]       = useState('desktop');
  const [scale, setScale]         = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [previewReady, setPreviewReady] = useState(false);

  const previewType = selectedFile ? getPreviewType(selectedFile.ext) : null;

  const DEVICES = {
    desktop: { width: '100%',  label: '🖥' },
    tablet:  { width: '768px', label: '📱 768' },
    mobile:  { width: '375px', label: '📱 375' },
  };

  // ── Build HTML string ───────────────────────────────────────────────────────
  const buildHtml = useCallback(async (src) => {
    if (!src || !previewType) return null;
    try {
      switch (previewType) {
        case 'html': {
          if (isEditing) return src;
          // For saved files, inline linked assets
          const bundle = await window.electronAPI.readPreviewBundle(selectedFile.path);
          return bundle.html;
        }
        case 'css':      return cssToHtml(src);
        case 'markdown': return markdownToHtml(src);
        case 'json':     return jsonToHtml(src);
        case 'svg':      return svgToHtml(src);
        default:         return null;
      }
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [previewType, isEditing, selectedFile]);

  // ── Inject into iframe via srcdoc (most reliable in Electron) ──────────────
  const updatePreview = useCallback(async () => {
    const src = isEditing ? editContent : content;
    if (!src || !iframeRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const html = await buildHtml(src);
      if (!html) { setLoading(false); return; }

      // Revoke previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      // Use blob URL — works in Electron without CSP issues
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      if (iframeRef.current) {
        iframeRef.current.src = url;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [content, editContent, isEditing, buildHtml]);

  // Debounced update
  useEffect(() => {
    clearTimeout(updateTimer.current);
    updateTimer.current = setTimeout(updatePreview, 250);
    return () => clearTimeout(updateTimer.current);
  }, [content, editContent, isEditing, refreshKey, updatePreview]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  if (!previewType) return null;

  return (
    <div className="live-preview-panel">

      {/* ── Header ── */}
      <div className="live-preview-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-preview-title">
            {loading
              ? <><span className="spinner" style={{ width: 10, height: 10, borderTopColor: 'var(--accent)', borderColor: 'rgba(0,122,204,0.2)' }} /> Rendering</>
              : '👁 Live Preview'}
          </span>
          {isEditing && (
            <span style={{ fontSize: 9, color: 'var(--success)', background: 'rgba(78,201,176,0.15)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, letterSpacing: 0.5 }}>
              LIVE
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 3 }}>
            {previewType.toUpperCase()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Device switcher */}
          {Object.entries(DEVICES).map(([key, val]) => (
            <button
              key={key}
              className={`preview-device-btn ${device === key ? 'active' : ''}`}
              onClick={() => setDevice(key)}
              title={key}
            >
              {val.label}
            </button>
          ))}

          {/* Zoom */}
          <select
            className="preview-zoom-select"
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
          </select>

          {/* Refresh */}
          <button className="btn btn-icon" onClick={() => setRefreshKey(k => k + 1)} title="Refresh">↺</button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div style={{ padding: '5px 12px', background: 'rgba(244,71,71,0.1)', color: 'var(--error)', fontSize: 11, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="live-preview-canvas">
        <div
          className="live-preview-device-frame"
          style={{
            width: DEVICES[device].width,
            transformOrigin: 'top center',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
          }}
        >
          <iframe
            ref={iframeRef}
            className="live-preview-iframe"
            title="Live Preview"
            onLoad={() => setPreviewReady(true)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            style={{ opacity: previewReady ? 1 : 0, transition: 'opacity 0.2s' }}
          />
        </div>
      </div>
    </div>
  );
}
