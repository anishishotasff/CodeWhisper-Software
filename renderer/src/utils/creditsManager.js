// ── Credits Manager ──────────────────────────────────────────────────────────
// Manages monthly credits locally with optional Firebase sync.
// Free: 100 credits/month | Premium: 1000 credits/month

export const CREDIT_COSTS = {
  CHAT:     1,   // AI chat message
  BUG_SCAN: 1,   // Bug detection
  BUG_FIX:  2,   // Auto bug fix
  REWRITE:  3,   // Code rewrite / improve
  ANALYZE:  5,   // Full project analysis
  EXPLAIN:  3,   // Flow explanation / intelligence panel
};

const STORAGE_KEY = 'cw_credits';

function getDefaultCredits(plan = 'free') {
  const max = plan === 'premium' ? 1000 : 100;
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  return {
    plan,
    credits: max,
    maxCredits: max,
    resetDate: resetDate.toISOString(),
    email: null,
    uid: null,
  };
}

export function loadCredits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultCredits();
    const data = JSON.parse(raw);
    // Auto-reset if past reset date
    if (new Date() > new Date(data.resetDate)) {
      const max = data.plan === 'premium' ? 1000 : 100;
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      const reset = { ...data, credits: max, resetDate: resetDate.toISOString() };
      saveCredits(reset);
      return reset;
    }
    return data;
  } catch {
    return getDefaultCredits();
  }
}

export function saveCredits(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function hasCredits(cost = 1) {
  const data = loadCredits();
  return data.credits >= cost;
}

export function deductCredits(cost = 1) {
  const data = loadCredits();
  if (data.credits < cost) return false;
  data.credits = Math.max(0, data.credits - cost);
  saveCredits(data);
  return true;
}

export function setUserSession(uid, email, plan = 'free', credits = null) {
  const existing = loadCredits();
  const max = plan === 'premium' ? 1000 : 100;
  const updated = {
    ...existing,
    uid,
    email,
    plan,
    maxCredits: max,
    // Only reset credits if this is a new login (different user)
    credits: existing.uid === uid ? existing.credits : (credits ?? max),
  };
  saveCredits(updated);
  return updated;
}

export function clearUserSession() {
  const data = loadCredits();
  const cleared = { ...data, uid: null, email: null };
  saveCredits(cleared);
}

export function getResetDateFormatted() {
  const data = loadCredits();
  return new Date(data.resetDate).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}
