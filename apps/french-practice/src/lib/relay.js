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

// Lightweight auth header for the relay. The app already stores no server
// session; this is a placeholder for whatever your host provides (Supabase
// auth, Clerk, next-auth session cookie, etc.). If you already have a
// session cookie, the relay can read it — no client header needed.
function relayHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('fp.relayToken');
    if (token) headers.Authorization = `Bearer ${JSON.parse(token)}`;
  } catch { /* ignore */ }
  // CSRF-safe: relay should also accept the browser's session cookie.
  return headers;
}

export function getRelayConfig() {
  return {
    enabled: relayEnabled,
    url: RELAY_URL || null,
    note: relayEnabled
      ? 'Live AI calls go through your authenticated server relay (key never leaves the server).'
      : 'Direct Groq calls — your key stays in this browser’s localStorage only. Fine for a private tool; wire VITE_GROQ_RELAY_URL for a public launch.',
  };
}

// Wrap a direct Groq call with quota + optional relay.
// `direct` is an async function that performs the direct fetch; `relayPath`
// is the relay endpoint path (e.g. "/chat/completions").
// When relay is enabled, we POST to `${RELAY_URL}${relayPath}` with the same
// JSON body. The relay forwards to Groq, applies quota, and returns Groq's
// JSON. The client contract is identical either way.
export async function withRelay({ label, body, direct }) {
  if (!relayEnabled) return direct();

  const res = await fetch(`${RELAY_URL}${label.startsWith('/') ? label : `/${label}`}`, {
    method: 'POST',
    headers: relayHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
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
