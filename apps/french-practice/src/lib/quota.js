// Client-side quota guard for Groq calls.
// Mirrors what a server relay would enforce. When a relay is configured,
// the server is the source of truth; this is the honest local preview.

const KEY = 'fp.quota';
const DEFAULT_LIMIT = Number(import.meta.env.VITE_GROQ_DAILY_LIMIT || 80);

function dayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { day: dayStamp(), count: 0, limit: DEFAULT_LIMIT };
    const j = JSON.parse(raw);
    if (j.day !== dayStamp()) return { day: dayStamp(), count: 0, limit: j.limit ?? DEFAULT_LIMIT };
    return { day: j.day, count: j.count || 0, limit: j.limit ?? DEFAULT_LIMIT };
  } catch {
    return { day: dayStamp(), count: 0, limit: DEFAULT_LIMIT };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function getQuota() {
  return read();
}

export function getRemaining() {
  const q = read();
  return Math.max(0, q.limit - q.count);
}

export function canCall(n = 1) {
  const q = read();
  return q.count + n <= q.limit;
}

export function consume(n = 1, label = 'call') {
  const q = read();
  // day rollover handled in read()
  if (q.count + n > q.limit) return { ok: false, quota: q, reason: 'daily quota exhausted' };
  q.count += n;
  write(q);
  return { ok: true, quota: q };
}

// For server relay responses that include quota headers
export function syncFromHeaders(headers) {
  try {
    const remaining = Number(headers.get?.('x-ratelimit-remaining'));
    const limit = Number(headers.get?.('x-ratelimit-limit'));
    if (Number.isFinite(limit)) {
      const q = read();
      q.limit = limit;
      if (Number.isFinite(remaining)) q.count = limit - remaining;
      write(q);
    }
  } catch { /* ignore */ }
}

export function formatQuota() {
  const q = read();
  return `${q.count}/${q.limit} today · ${getRemaining()} remaining`;
}
