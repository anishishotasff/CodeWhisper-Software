/**
 * Analyzes a list of scanned files and generates a human-readable project summary.
 * This runs entirely client-side — no AI needed for the basic summary.
 */

const PROJECT_SIGNATURES = [
  { type: 'Node.js / JavaScript', files: ['package.json'], exts: ['.js', '.mjs'] },
  { type: 'TypeScript', files: ['tsconfig.json'], exts: ['.ts', '.tsx'] },
  { type: 'React', files: [], exts: ['.jsx', '.tsx'], keywords: ['react'] },
  { type: 'Python', files: ['requirements.txt', 'setup.py', 'pyproject.toml'], exts: ['.py'] },
  { type: 'Rust', files: ['Cargo.toml'], exts: ['.rs'] },
  { type: 'Go', files: ['go.mod'], exts: ['.go'] },
  { type: 'Java / Maven', files: ['pom.xml'], exts: ['.java'] },
  { type: 'Java / Gradle', files: ['build.gradle'], exts: ['.java'] },
  { type: 'Ruby', files: ['Gemfile'], exts: ['.rb'] },
  { type: 'PHP', files: ['composer.json'], exts: ['.php'] },
  { type: 'C/C++', files: ['CMakeLists.txt', 'Makefile'], exts: ['.c', '.cpp', '.h'] },
  { type: 'Docker', files: ['Dockerfile', 'docker-compose.yml'], exts: [] },
];

export function analyzeProject(rootPath, files) {
  const fileNames = files.map(f => f.name.toLowerCase());
  const extCounts = {};
  const folderSet = new Set();

  for (const f of files) {
    extCounts[f.ext] = (extCounts[f.ext] || 0) + 1;
    // Extract top-level folder from path
    const rel = f.path.replace(rootPath, '').replace(/\\/g, '/');
    const parts = rel.split('/').filter(Boolean);
    if (parts.length > 1) folderSet.add(parts[0]);
  }

  // Detect project type
  const detected = [];
  for (const sig of PROJECT_SIGNATURES) {
    const hasFile = sig.files.some(f => fileNames.includes(f.toLowerCase()));
    const hasExt = sig.exts.some(e => extCounts[e] > 0);
    if (hasFile || hasExt) detected.push(sig.type);
  }

  // Top extensions
  const topExts = Object.entries(extCounts)
    .filter(([ext]) => ext)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext} (${count} files)`);

  // Important files present
  const importantFiles = [
    'package.json', 'tsconfig.json', 'readme.md', 'dockerfile',
    'docker-compose.yml', 'requirements.txt', '.env', 'makefile',
    'cargo.toml', 'go.mod', 'pom.xml',
  ].filter(name => fileNames.includes(name));

  // Total size
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

  const lines = [
    `📁 Project: ${rootPath.split(/[\\/]/).pop()}`,
    `📍 Path: ${rootPath}`,
    '',
    `🔍 Detected Type: ${detected.length ? detected.join(', ') : 'Unknown'}`,
    '',
    `📊 Stats:`,
    `  • Total files: ${files.length}`,
    `  • Total size: ${sizeMB} MB`,
    `  • Top-level folders: ${[...folderSet].slice(0, 8).join(', ') || 'none'}`,
    '',
    `📝 Main file types:`,
    ...topExts.map(e => `  • ${e}`),
    '',
  ];

  if (importantFiles.length) {
    lines.push(`⭐ Key files found:`);
    importantFiles.forEach(f => lines.push(`  • ${f}`));
    lines.push('');
  }

  if (folderSet.size > 0) {
    lines.push(`📂 Folder structure:`);
    [...folderSet].slice(0, 10).forEach(f => lines.push(`  • /${f}`));
    lines.push('');
  }

  lines.push(`💡 Tip: Ask the AI chat panel to explain any file or the overall project.`);

  return lines.join('\n');
}
