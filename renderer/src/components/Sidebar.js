import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IMPORTANT_FILES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock',
  'index.js', 'index.ts', 'main.js', 'main.ts',
  'app.js', 'app.ts', 'app.jsx', 'app.tsx',
  'readme.md', 'readme.txt',
  'dockerfile', 'docker-compose.yml',
  '.env', 'requirements.txt', 'setup.py', 'cargo.toml',
  'go.mod', 'pom.xml', 'build.gradle',
]);

function getIcon(node) {
  if (node.type === 'directory') return '📁';
  const ext = node.ext || '';
  const icons = {
    '.js': '🟨', '.jsx': '🟨', '.ts': '🔷', '.tsx': '🔷',
    '.py': '🐍', '.rb': '💎', '.go': '🐹', '.rs': '🦀',
    '.java': '☕', '.cs': '🔵', '.cpp': '⚙️', '.c': '⚙️',
    '.html': '🌐', '.css': '🎨', '.scss': '🎨', '.less': '🎨',
    '.json': '📋', '.yaml': '📋', '.yml': '📋', '.toml': '📋',
    '.md': '📝', '.txt': '📄', '.env': '🔑',
    '.png': '🖼️', '.jpg': '🖼️', '.svg': '🖼️', '.gif': '🖼️',
    '.sh': '🖥️', '.bash': '🖥️', '.zsh': '🖥️',
    '.sql': '🗄️', '.graphql': '🔗',
  };
  return icons[ext] || '📄';
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// Animation variants
const rowVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.15, ease: 'easeOut' } },
};

const childrenVariants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, height: 0,    transition: { duration: 0.15, ease: 'easeIn' } },
};

function TreeNode({ node, depth = 0, selectedFile, onSelectFile, index = 0 }) {
  const [open, setOpen] = useState(depth < 2);

  const isDir      = node.type === 'directory';
  const isSelected = selectedFile?.path === node.path;
  const isImportant = IMPORTANT_FILES.has(node.name.toLowerCase());

  const handleClick = () => {
    if (isDir) setOpen(o => !o);
    else onSelectFile(node);
  };

  return (
    <motion.div
      className="tree-node"
      variants={rowVariants}
      initial="initial"
      animate="animate"
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      <motion.div
        className={`tree-node-row ${isSelected ? 'active' : ''} ${isImportant && !isSelected ? 'important' : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={handleClick}
        title={node.path}
        whileHover={{ backgroundColor: isSelected ? undefined : 'rgba(255,255,255,0.04)', x: 2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {isDir && (
          <motion.span
            style={{ fontSize: 10, color: 'var(--text-dim)', width: 10, display: 'inline-block' }}
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            ▸
          </motion.span>
        )}
        <span className="tree-icon">{getIcon(node)}</span>
        <span className="tree-name">{node.name}</span>
        {!isDir && node.size > 0 && (
          <span className="tree-size">{formatSize(node.size)}</span>
        )}
      </motion.div>

      <AnimatePresence initial={false}>
        {isDir && open && node.children && (
          <motion.div
            className="tree-children"
            variants={childrenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((child, i) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Sidebar({ tree, selectedFile, onSelectFile }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Explorer</span>
        {tree && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
          >
            {tree.name}
          </motion.span>
        )}
      </div>

      <div className="sidebar-tree">
        <AnimatePresence mode="wait">
          {!tree ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: '20px 12px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}
            >
              Open a project to explore files
            </motion.div>
          ) : (
            <motion.div
              key="tree"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {tree.children?.map((node, i) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  onSelectFile={onSelectFile}
                  index={i}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
