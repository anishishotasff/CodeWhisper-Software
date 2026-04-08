import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatComplete, PROVIDERS } from '../utils/aiProvider';
import { hasCredits, deductCredits, CREDIT_COSTS } from '../utils/creditsManager';

const QUICK_PROMPTS = [
  'Explain this project',
  'What does this file do?',
  'Find bugs in this file',
  'What are the main dependencies?',
  'How is this code structured?',
  'Suggest improvements',
];

// Typing effect hook — streams text character by character
function useTypingEffect(text, speed = 8) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    // Chunk size — larger = faster rendering
    const chunk = Math.max(1, Math.floor(text.length / 120));

    const tick = () => {
      i += chunk;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
      } else {
        setDisplayed(text.slice(0, i));
        timerRef.current = setTimeout(tick, speed);
      }
    };
    timerRef.current = setTimeout(tick, speed);
    return () => clearTimeout(timerRef.current);
  }, [text, speed]);

  return { displayed, done };
}

// Message with typing animation for assistant messages
function AnimatedMessage({ msg, isLatest }) {
  const shouldAnimate = msg.role === 'assistant' && isLatest;
  const { displayed } = useTypingEffect(shouldAnimate ? msg.content : null, 6);
  const content = shouldAnimate ? displayed : msg.content;

  return (
    <motion.div
      className={`chat-message ${msg.role}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <MessageContent content={content} />
    </motion.div>
  );
}

export default function ChatPanel({ selectedFile, fileContent, summary, projectPath, aiSettings, apiKey, onApiKeyChange, onCreditUsed }) {
  const [messages, setMessages] = useState([
    { role: 'system', content: '👋 Hi! Open a project and ask me anything about your code. I can explain files, find bugs, suggest improvements, and more.' },
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [keyInput, setKeyInput]   = useState('');
  const [showKeyForm, setShowKeyForm] = useState(!apiKey);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (aiSettings?.provider === PROVIDERS.OLLAMA) setShowKeyForm(false);
    else if (!apiKey) setShowKeyForm(true);
  }, [apiKey, aiSettings?.provider]);

  const saveKey = () => {
    if (!keyInput.trim()) return;
    localStorage.setItem('openai_key', keyInput.trim());
    onApiKeyChange(keyInput.trim());
    setShowKeyForm(false);
    setKeyInput('');
  };

  const buildContext = () => {
    const parts = [];
    if (summary) parts.push(`PROJECT SUMMARY:\n${summary}`);
    if (selectedFile && fileContent) {
      parts.push(`CURRENT FILE: ${selectedFile.name}\n\`\`\`\n${fileContent.slice(0, 5000)}\n\`\`\``);
    }
    return parts.join('\n\n');
  };

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    if (!apiKey) { setShowKeyForm(true); return; }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    // Deduct credit (skip for local Ollama)
    if (aiSettings?.provider !== PROVIDERS.OLLAMA) {
      if (!hasCredits(CREDIT_COSTS.CHAT)) {
        setMessages(prev => [...prev, { role: 'error', content: '⚡ Out of credits. Resets next month or upgrade to Premium.' }]);
        setLoading(false);
        return;
      }
      deductCredits(CREDIT_COSTS.CHAT);
      onCreditUsed?.();
    }

    try {
      const context = buildContext();
      const systemPrompt = `You are CodeWhisper, an expert AI coding assistant. You help developers understand, debug, and improve codebases.
Be concise, precise, and developer-friendly. Use markdown formatting with code blocks when showing code.
When finding bugs, be specific about line numbers and what the fix should be.
${context ? `\n\nContext:\n${context}` : ''}`;

      const history = messages
        .filter(m => m.role !== 'system')
        .slice(-12)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await chatComplete({
        provider: aiSettings?.provider,
        apiKey: aiSettings?.openaiKey,
        model: aiSettings?.provider === PROVIDERS.OLLAMA ? aiSettings?.ollamaModel : aiSettings?.openaiModel,
        ollamaUrl: aiSettings?.ollamaUrl,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: userText },
        ],
        maxTokens: 1500,
        temperature: 0.3,
      });

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'error', content: `❌ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'system', content: '👋 Chat cleared. Ask me anything about your code!' }]);
  };

  const contextLabel = selectedFile
    ? `📄 ${selectedFile.name}`
    : summary ? '📊 Project analyzed'
    : projectPath ? '📁 Project open'
    : null;

  return (
    <aside className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <span>🤖 AI Assistant
          {aiSettings?.provider === PROVIDERS.OLLAMA && (
            <span className="chat-local-badge">🔒 Local</span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <motion.button whileTap={{ scale: 0.88 }} className="btn btn-icon" onClick={clearChat}>🗑</motion.button>
          <motion.button whileTap={{ scale: 0.88 }} className="btn btn-icon" onClick={() => setShowKeyForm(v => !v)}>🔑</motion.button>
        </div>
      </div>

      {/* API Key form */}
      <AnimatePresence>
        {showKeyForm && (
          <motion.div
            className="api-key-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <input
              className="api-key-input"
              type="password"
              placeholder="Paste OpenAI API key (sk-...)..."
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveKey()}
              autoFocus
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              className="btn btn-primary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={saveKey}
            >Save</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick prompts */}
      {projectPath && (
        <div className="quick-prompts">
          {QUICK_PROMPTS.map((p, i) => (
            <motion.button
              key={p}
              className="quick-prompt-btn"
              onClick={() => sendMessage(p)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.15 }}
              whileHover={{ scale: 1.03, borderColor: 'var(--accent)' }}
              whileTap={{ scale: 0.96 }}
            >
              {p}
            </motion.button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <AnimatedMessage
              key={i}
              msg={msg}
              isLatest={i === messages.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              className="chat-message assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CodeWhisper is thinking</span>
              <span className="dot" /><span className="dot" /><span className="dot" />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        {contextLabel && (
          <motion.span
            className="chat-context-badge"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            {contextLabel}
          </motion.span>
        )}
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            rows={2}
            placeholder="Ask about your code... (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            disabled={loading}
          />
          <motion.button
            className="btn btn-primary"
            style={{ padding: '6px 10px', alignSelf: 'flex-end' }}
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
          >
            ➤
          </motion.button>
        </div>
      </div>
    </aside>
  );
}

function MessageContent({ content }) {
  if (!content?.includes('```')) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
  }
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(1).join('\n');
          return (
            <pre key={i} className="chat-code-block">
              {lang && <span className="chat-code-lang">{lang}</span>}
              <code>{code}</code>
            </pre>
          );
        }
        return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </span>
  );
}
