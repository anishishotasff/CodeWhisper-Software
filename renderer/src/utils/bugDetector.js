/**
 * Static Bug Risk Detector
 * Scans code client-side — no API needed.
 * Returns an array of { line, col, severity, category, message, snippet }
 */

const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 };

export function detectBugs(code, ext) {
  const lines = code.split('\n');
  const issues = [];
  const lang = getLangFamily(ext);

  // Run all detectors
  detectUnusedVariables(lines, lang, issues);
  detectInfiniteLoops(lines, lang, issues);
  detectMissingErrorHandling(lines, lang, issues);
  detectEmptyCatchBlocks(lines, lang, issues);
  detectConsoleLeftovers(lines, lang, issues);
  detectTodoFixme(lines, issues);
  detectHardcodedSecrets(lines, issues);
  detectNullDereference(lines, lang, issues);
  detectAsyncWithoutAwait(lines, lang, issues);
  detectDuplicateKeys(lines, lang, issues);

  // Sort by severity then line number
  return issues.sort((a, b) =>
    SEVERITY[a.severity] - SEVERITY[b.severity] || a.line - b.line
  );
}

function getLangFamily(ext) {
  if (['.js','.jsx','.ts','.tsx','.mjs'].includes(ext)) return 'js';
  if (ext === '.py') return 'py';
  if (ext === '.go') return 'go';
  if (['.java','.kt'].includes(ext)) return 'java';
  return 'generic';
}

// ── 1. Unused variables (JS/TS) ──────────────────────────────────────────────
function detectUnusedVariables(lines, lang, issues) {
  if (lang !== 'js') return;
  const declared = new Map(); // name → lineIndex

  lines.forEach((line, i) => {
    // Match: const/let/var name = ...
    const m = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*=/);
    if (m) declared.set(m[1], i);
  });

  const fullCode = lines.join('\n');
  declared.forEach((lineIdx, name) => {
    // Count occurrences beyond the declaration line
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = [...fullCode.matchAll(regex)];
    if (matches.length <= 1) {
      issues.push({
        line: lineIdx + 1,
        severity: 'low',
        category: 'Unused Variable',
        message: `'${name}' is declared but never used`,
        snippet: lines[lineIdx].trim(),
        icon: '🔵',
      });
    }
  });
}

// ── 2. Infinite loop patterns ────────────────────────────────────────────────
function detectInfiniteLoops(lines, lang, issues) {
  lines.forEach((line, i) => {
    const t = line.trim();

    // while(true) / while(1) without break inside next few lines
    if (/while\s*\(\s*(true|1)\s*\)/.test(t)) {
      const block = lines.slice(i, i + 20).join('\n');
      if (!/\bbreak\b|\breturn\b|\bthrow\b/.test(block)) {
        issues.push({
          line: i + 1,
          severity: 'critical',
          category: 'Infinite Loop',
          message: 'while(true) with no break/return/throw detected in block',
          snippet: t,
          icon: '🔴',
        });
      }
    }

    // for(;;) without break
    if (/for\s*\(\s*;\s*;\s*\)/.test(t)) {
      const block = lines.slice(i, i + 20).join('\n');
      if (!/\bbreak\b|\breturn\b/.test(block)) {
        issues.push({
          line: i + 1,
          severity: 'critical',
          category: 'Infinite Loop',
          message: 'for(;;) with no break/return detected in block',
          snippet: t,
          icon: '🔴',
        });
      }
    }

    // Recursive call without base case (simple heuristic)
    if (lang === 'js') {
      const fnMatch = t.match(/function\s+(\w+)\s*\(/);
      if (fnMatch) {
        const fnName = fnMatch[1];
        const block = lines.slice(i + 1, i + 30).join('\n');
        const callCount = (block.match(new RegExp(`\\b${fnName}\\s*\\(`, 'g')) || []).length;
        const hasCondition = /\bif\b|\breturn\b/.test(block.slice(0, 200));
        if (callCount >= 1 && !hasCondition) {
          issues.push({
            line: i + 1,
            severity: 'high',
            category: 'Infinite Loop',
            message: `'${fnName}' may recurse infinitely — no base case found`,
            snippet: t,
            icon: '🔴',
          });
        }
      }
    }
  });
}

// ── 3. Missing error handling on async/await ─────────────────────────────────
function detectMissingErrorHandling(lines, lang, issues) {
  if (lang !== 'js') return;
  lines.forEach((line, i) => {
    const t = line.trim();
    // await without try/catch — check if inside a try block
    if (/\bawait\s+\w/.test(t)) {
      const before = lines.slice(Math.max(0, i - 15), i).join('\n');
      const after  = lines.slice(i, Math.min(lines.length, i + 15)).join('\n');
      const inTry  = /\btry\s*\{/.test(before) && /\bcatch\s*\(/.test(after);
      const hasCatch = /\.catch\s*\(/.test(t) || /\.catch\s*\(/.test(lines[i + 1] || '');
      if (!inTry && !hasCatch) {
        issues.push({
          line: i + 1,
          severity: 'high',
          category: 'Missing Error Handling',
          message: 'await used without try/catch or .catch() — unhandled rejection risk',
          snippet: t,
          icon: '🟠',
        });
      }
    }

    // fetch() without .catch
    if (/\bfetch\s*\(/.test(t)) {
      const nextLines = lines.slice(i, i + 6).join('\n');
      if (!/\.catch\s*\(/.test(nextLines) && !/try\s*\{/.test(lines.slice(Math.max(0,i-5),i).join('\n'))) {
        issues.push({
          line: i + 1,
          severity: 'medium',
          category: 'Missing Error Handling',
          message: 'fetch() call without .catch() — network errors will be unhandled',
          snippet: t,
          icon: '🟠',
        });
      }
    }

    // Promise without .catch
    if (/new\s+Promise\s*\(/.test(t)) {
      const block = lines.slice(i, i + 10).join('\n');
      if (!/\.catch\s*\(/.test(block) && !/reject\s*\(/.test(block)) {
        issues.push({
          line: i + 1,
          severity: 'medium',
          category: 'Missing Error Handling',
          message: 'new Promise() without reject handler or .catch()',
          snippet: t,
          icon: '🟠',
        });
      }
    }
  });
}

// ── 4. Empty catch blocks ────────────────────────────────────────────────────
function detectEmptyCatchBlocks(lines, lang, issues) {
  lines.forEach((line, i) => {
    if (/\bcatch\s*\(/.test(line)) {
      // Look at next 1-3 lines for empty block
      const block = lines.slice(i, i + 4).join('\n');
      if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(block) ||
          (lines[i + 1] && /^\s*\}\s*$/.test(lines[i + 1]))) {
        issues.push({
          line: i + 1,
          severity: 'high',
          category: 'Empty Catch Block',
          message: 'Empty catch block silently swallows errors',
          snippet: line.trim(),
          icon: '🟠',
        });
      }
    }
  });
}

// ── 5. Console.log leftovers ─────────────────────────────────────────────────
function detectConsoleLeftovers(lines, lang, issues) {
  if (lang !== 'js') return;
  lines.forEach((line, i) => {
    if (/console\.(log|warn|error|debug|info)\s*\(/.test(line) && !/\/\/.*console/.test(line)) {
      issues.push({
        line: i + 1,
        severity: 'low',
        category: 'Debug Leftover',
        message: 'console statement left in code — remove before production',
        snippet: line.trim(),
        icon: '🔵',
      });
    }
  });
}

// ── 6. TODO / FIXME / HACK comments ─────────────────────────────────────────
function detectTodoFixme(lines, issues) {
  lines.forEach((line, i) => {
    const m = line.match(/\/\/.*\b(TODO|FIXME|HACK|XXX|BUG)\b(.{0,60})/i);
    if (m) {
      const isFixme = /FIXME|HACK|BUG/i.test(m[1]);
      issues.push({
        line: i + 1,
        severity: isFixme ? 'medium' : 'low',
        category: m[1].toUpperCase(),
        message: m[2].trim() || `${m[1]} comment found`,
        snippet: line.trim(),
        icon: isFixme ? '🟡' : '🔵',
      });
    }
  });
}

// ── 7. Hardcoded secrets / credentials ──────────────────────────────────────
function detectHardcodedSecrets(lines, issues) {
  const secretPatterns = [
    { re: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/i, label: 'Hardcoded password' },
    { re: /(?:api_?key|apikey|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, label: 'Hardcoded API key/secret' },
    { re: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key exposed' },
    { re: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key exposed' },
    { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: 'Private key in source code' },
  ];
  lines.forEach((line, i) => {
    if (/\/\//.test(line.slice(0, line.indexOf('=') > 0 ? line.indexOf('=') : 999))) return; // skip comments
    for (const { re, label } of secretPatterns) {
      if (re.test(line)) {
        issues.push({
          line: i + 1,
          severity: 'critical',
          category: 'Security Risk',
          message: label,
          snippet: line.trim().slice(0, 60) + (line.length > 60 ? '…' : ''),
          icon: '🔴',
        });
        break;
      }
    }
  });
}

// ── 8. Potential null dereference ────────────────────────────────────────────
function detectNullDereference(lines, lang, issues) {
  if (lang !== 'js') return;
  lines.forEach((line, i) => {
    // obj.property where obj could be null (no optional chaining)
    if (/\w+\.\w+/.test(line) && !/\?\.\w/.test(line)) {
      // Look for patterns like: result.data, response.json, data.items
      const m = line.match(/\b(\w+)\.(map|filter|forEach|reduce|find|length|data|items|results)\b/);
      if (m) {
        // Check if variable was checked for null/undefined nearby
        const context = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (!new RegExp(`\\b${m[1]}\\b.*(?:&&|\\?|null|undefined|!)`).test(context)) {
          issues.push({
            line: i + 1,
            severity: 'medium',
            category: 'Null Dereference Risk',
            message: `'${m[1]}.${m[2]}' — '${m[1]}' may be null/undefined`,
            snippet: line.trim(),
            icon: '🟡',
          });
        }
      }
    }
  });
}

// ── 9. async function without await ─────────────────────────────────────────
function detectAsyncWithoutAwait(lines, lang, issues) {
  if (lang !== 'js') return;
  let inAsync = false;
  let asyncStart = 0;
  let braceDepth = 0;
  let hasAwait = false;

  lines.forEach((line, i) => {
    if (/\basync\s+function\b|\basync\s+\(/.test(line)) {
      inAsync = true;
      asyncStart = i;
      braceDepth = 0;
      hasAwait = false;
    }
    if (inAsync) {
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (/\bawait\b/.test(line)) hasAwait = true;
      if (braceDepth <= 0 && asyncStart !== i) {
        if (!hasAwait) {
          issues.push({
            line: asyncStart + 1,
            severity: 'low',
            category: 'Unnecessary async',
            message: 'async function has no await — consider removing async keyword',
            snippet: lines[asyncStart].trim(),
            icon: '🔵',
          });
        }
        inAsync = false;
      }
    }
  });
}

// ── 10. Duplicate object keys ────────────────────────────────────────────────
function detectDuplicateKeys(lines, lang, issues) {
  if (lang !== 'js') return;
  const fullCode = lines.join('\n');
  // Find object literals and check for duplicate keys
  const objPattern = /\{([^{}]{10,200})\}/g;
  let match;
  while ((match = objPattern.exec(fullCode)) !== null) {
    const body = match[1];
    const keys = [...body.matchAll(/^\s*['"]?(\w+)['"]?\s*:/gm)].map(m => m[1]);
    const seen = new Set();
    for (const key of keys) {
      if (seen.has(key)) {
        // Find line number
        const pos = fullCode.slice(0, match.index).split('\n').length;
        issues.push({
          line: pos,
          severity: 'high',
          category: 'Duplicate Key',
          message: `Duplicate object key '${key}' — last value silently overwrites previous`,
          snippet: `{ ...${key}: ... }`,
          icon: '🟠',
        });
        break;
      }
      seen.add(key);
    }
  }
}

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
export const SEVERITY_COLOR = {
  critical: '#f44747',
  high:     '#e07b39',
  medium:   '#dcdcaa',
  low:      '#858585',
};
export const SEVERITY_BG = {
  critical: 'rgba(244,71,71,0.1)',
  high:     'rgba(224,123,57,0.1)',
  medium:   'rgba(220,220,170,0.08)',
  low:      'rgba(133,133,133,0.08)',
};
