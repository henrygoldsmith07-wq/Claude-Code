// Example Node server relay for Groq — keeps the API key off the client.
// Deploy separately (Vercel / Fly / Render) and set env: GROQ_API_KEY.
// The client enables the relay by setting VITE_GROQ_RELAY_URL to this origin
// (e.g. "https://studio-relay.example.com/api/groq").
//
// This is a minimal reference implementation — wire your real auth (next-auth,
// Supabase, etc.) into `authenticate` and tighten quotas as needed. The client
// still works without a relay (private personal-tool mode) — this is only for
// the public-consumer path.

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// ---- auth placeholder ----
// Replace with your real session check. Return { ok: true, userId } or
// { ok: false, status, message }. For a demo we allow anonymous with a tight
// quota; for a public launch require auth and return 401.
async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return { ok: true, userId: token ? `token:${token.slice(0, 8)}` : 'anon', anon: !token };
}

// ---- per-user daily quota (in-memory — swap for Redis/Upstash in prod) ----
const buckets = new Map(); // userId -> { day, count }
const LIMIT_AUTHED = Number(process.env.GROQ_DAILY_LIMIT_AUTHED || 120);
const LIMIT_ANON = Number(process.env.GROQ_DAILY_LIMIT_ANON || 20);
const dayStamp = (d = new Date()) => d.toISOString().slice(0, 10);

function checkQuota(userId, anon) {
  const limit = anon ? LIMIT_ANON : LIMIT_AUTHED;
  const day = dayStamp();
  let b = buckets.get(userId);
  if (!b || b.day !== day) { b = { day, count: 0 }; buckets.set(userId, b); }
  if (b.count >= limit) return { ok: false, limit, remaining: 0 };
  b.count += 1;
  return { ok: true, limit, remaining: Math.max(0, limit - b.count) };
}

function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : (origin || ''),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Export as a Node http handler *and* a Vercel-style (req,res) handler.
// Mount tip for Vite: add a dev proxy `'/api/groq' -> relay origin` in vite.config.js
// when testing with a local relay. In prod set VITE_GROQ_RELAY_URL to the deployed origin.

export default async function handler(req, res) {
  const origin = req.headers.origin;
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.setHeader(k, v);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, relay: 'groq', anonLimit: LIMIT_ANON, authedLimit: LIMIT_AUTHED });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured on the server' });

  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.message || 'Unauthorized' });

  const quota = checkQuota(auth.userId, auth.anon);
  res.setHeader('x-ratelimit-limit', String(auth.anon ? LIMIT_ANON : LIMIT_AUTHED));
  res.setHeader('x-ratelimit-remaining', String(quota.remaining));
  if (!quota.ok) return res.status(429).json({ error: `Daily quota reached (${quota.limit} calls). Try again tomorrow.` });

  // Subpath after /api/groq — e.g. /chat/completions — defaults to chat.
  const subpath = (req.query?.path ? [].concat(req.query.path).join('/') : '') || 'chat/completions';
  const alt = req.url?.split('?')[0]?.replace(/^\/api\/groq\/?/, '') || '';
  const path = subpath !== 'chat/completions' ? subpath : (alt || 'chat/completions');
  const url = `${GROQ_BASE}/${path}`;

  let groqRes;
  try {
    const isJson = (req.headers['content-type'] || '').includes('json');
    const body = isJson ? JSON.stringify(req.body) : req.body;
    groqRes = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, ...(isJson ? { 'Content-Type': 'application/json' } : {}) },
      body,
      signal: AbortSignal.timeout(45000),
    });
  } catch (e) {
    return res.status(502).json({ error: `Upstream Groq fetch failed: ${String(e.message).slice(0, 200)}` });
  }

  const text = await groqRes.text();
  res.status(groqRes.status);
  const ct = groqRes.headers.get('content-type');
  if (ct) res.setHeader('content-type', ct);
  return res.send(text);
}
