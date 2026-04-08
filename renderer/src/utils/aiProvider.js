/**
 * AI Provider — unified interface for OpenAI and Ollama (local/private mode)
 *
 * OpenAI:  sends data to api.openai.com
 * Ollama:  sends data to localhost:11434 — 100% private, no internet
 */

export const PROVIDERS = {
  OPENAI: 'openai',
  OLLAMA: 'ollama',
  GEMINI: 'gemini',
};

export const OLLAMA_MODELS = [
  { id: 'llama3',         label: 'Llama 3 (8B)',        desc: 'Fast, great for chat' },
  { id: 'llama3:70b',     label: 'Llama 3 (70B)',       desc: 'Powerful, needs 48GB RAM' },
  { id: 'codellama',      label: 'CodeLlama (7B)',       desc: 'Optimized for code' },
  { id: 'codellama:13b',  label: 'CodeLlama (13B)',      desc: 'Better code understanding' },
  { id: 'deepseek-coder', label: 'DeepSeek Coder (6.7B)', desc: 'Excellent for code tasks' },
  { id: 'mistral',        label: 'Mistral (7B)',         desc: 'Fast & smart general model' },
  { id: 'gemma2',         label: 'Gemma 2 (9B)',         desc: 'Google\'s open model' },
  { id: 'phi3',           label: 'Phi-3 Mini (3.8B)',    desc: 'Tiny but capable' },
];

/**
 * Send a chat completion request to the configured provider.
 * @param {object} opts
 * @param {string} opts.provider  - 'openai' | 'ollama'
 * @param {string} opts.apiKey    - OpenAI key (ignored for Ollama)
 * @param {string} opts.model     - model name
 * @param {string} opts.ollamaUrl - Ollama base URL (default: http://localhost:11434)
 * @param {Array}  opts.messages  - [{role, content}]
 * @param {number} opts.maxTokens
 * @param {number} opts.temperature
 * @param {boolean} opts.jsonMode - request JSON output
 * @returns {Promise<string>} - assistant reply text
 */
export async function chatComplete({
  provider = PROVIDERS.OPENAI,
  apiKey,
  model,
  ollamaUrl = 'http://localhost:11434',
  messages,
  maxTokens = 1500,
  temperature = 0.3,
  jsonMode = false,
}) {
  if (provider === PROVIDERS.OLLAMA) {
    return ollamaChat({ ollamaUrl, model, messages, maxTokens, temperature, jsonMode });
  }
  if (provider === PROVIDERS.GEMINI || (apiKey && apiKey.startsWith('AIza'))) {
    return geminiChat({ apiKey, messages, maxTokens, temperature, jsonMode });
  }
  return openaiChat({ apiKey, model, messages, maxTokens, temperature, jsonMode });
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
async function openaiChat({ apiKey, model = 'gpt-4o-mini', messages, maxTokens, temperature, jsonMode }) {
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
async function geminiChat({ apiKey, messages, maxTokens, temperature, jsonMode }) {
  // Convert OpenAI-style messages to Gemini format
  // System message gets prepended to first user message
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Prepend system prompt to first user message if exists
  if (systemMsg && contents.length > 0 && contents[0].role === 'user') {
    contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
  }

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Ollama ───────────────────────────────────────────────────────────────────
async function ollamaChat({ ollamaUrl, model = 'llama3', messages, temperature, jsonMode }) {
  const url = `${ollamaUrl}/api/chat`;

  const body = {
    model,
    messages,
    stream: false,
    options: { temperature },
  };
  if (jsonMode) body.format = 'json';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 0 || res.type === 'error') {
      throw new Error('Cannot connect to Ollama. Make sure it is running: ollama serve');
    }
    throw new Error(`Ollama error ${res.status} — is the model downloaded? Run: ollama pull ${model}`);
  }

  const data = await res.json();
  return data.message?.content || data.response || '';
}

/**
 * Check if Ollama is running and return available models.
 */
export async function checkOllama(ollamaUrl = 'http://localhost:11434') {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false, models: [] };
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

/**
 * Load AI settings from localStorage.
 */
export function loadAISettings() {
  try {
    const raw = localStorage.getItem('codewhisper_ai_settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    provider: PROVIDERS.OPENAI,
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
  };
}

/**
 * Save AI settings to localStorage.
 */
export function saveAISettings(settings) {
  localStorage.setItem('codewhisper_ai_settings', JSON.stringify(settings));
  // Keep legacy key in sync for backward compat
  if (settings.openaiKey) localStorage.setItem('openai_key', settings.openaiKey);
}
