// Authenticated server relay abstraction for the public-consumer path.
// Configuration:
//   VITE_GROQ_RELAY_URL — if empty, all calls go direct to Groq with the
//     user's own key (private personal-tool mode — reasonable, documented).
//   VITE_GROQ_RELAY_URL set (e.g. "/api/groq" or "https://studio.example.com/api/groq")
//     — calls are proxied through an authenticated endpoint that holds the
//       Groq key server-side, enforces per-user quotas, and never exposes the
//       secret to the browser.
// The client automatically chooses the right path; callers still import from
// '../lib/groq' — they never touch this file.

const RELAY_URL = String(import.meta.env.VITE_GROQ_RELAY_URL || '').trim();
export const relayEnabled = Boolean(RELAY_URL);

// The host is responsible for injecting a verified identity token. The relay
// verifies it server-side; this browser helper never creates or signs tokens.
function relayHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const injected = globalThis.__LE_STUDIO_AUTH_TOKEN__;
  if (typeof injected === 'string' && injected.trim()) {
    headers.Authorization = `Bearer ${injected.trim()}`;
    return headers;
  }
  try {
    const stored = localStorage.getItem('fp.relayToken');
    if (stored) {
      let token = stored;
      try { token = JSON.parse(stored); } catch { /* raw token */ }
      if (typeof token === 'string' && token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    }
  } catch { /* ignore */ }
  return headers;
}

export function getRelayConfig() {
  return {
    enabled: relayEnabled,
    url: RELAY_URL || null,
    note: relayEnabled
      ? 'Live AI calls go through the authenticated server relay (the Groq key never reaches the browser).'
      : 'Direct Groq calls — your key stays in this browser’s localStorage only. Fine for a private tool; wire VITE_GROQ_RELAY_URL for a public launch.',
  };
}

function relayEndpoint(path) {
  const suffix = String(path || '').startsWith('/') ? String(path) : `/${path}`;
  return RELAY_URL.replace(/\/+$/, '') + suffix;
}

export async function withRelay({ label, path = label, body, direct }) {
  if (!relayEnabled) return direct();

  const res = await fetch(relayEndpoint(path), {
    method: 'POST',
    headers: relayHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      msg = j.error || j.message || msg;
    } catch { /* keep text */ }
    if (res.status === 429) throw new Error(`Rate limited by your relay (429): ${msg}`);
    if (res.status === 401 || res.status === 403) throw new Error(`Relay rejected your session (${res.status}): ${msg}`);
    throw new Error(`Relay ${label} failed (${res.status}): ${msg}`);
  }

  // Quota headers from relay (conventional)
  try {
    const { syncFromHeaders } = await import('./quota.js');
    syncFromHeaders(res.headers);
  } catch { /* ignore */ }

  return JSON.parse(text);
}

export async function pingRelay() {
  if (!relayEnabled) throw new Error('Relay is not enabled.');
  const res = await fetch(relayEndpoint('/healthz'), {
    method: 'GET',
    headers: relayHeaders(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Relay health check failed (${res.status})`);
  return res.json();
}
