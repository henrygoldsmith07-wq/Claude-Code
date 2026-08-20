import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
  createInMemoryQuotaStore,
  createRelayHandler,
  createUpstashQuotaStore,
  QUOTA_SCRIPT,
} from '../server/relay.js';

const SIGNING_MATERIAL = 'fixture-signing-material-for-tests-only-2026-08-20';
const OTHER_SIGNING_MATERIAL = 'other-fixture-signing-material-for-tests-only';
const NOW = Date.parse('2026-08-20T12:00:00.000Z');

function b64(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function token({ signingKey = SIGNING_MATERIAL, sub = 'user-1', exp = NOW / 1000 + 3600, ...claims } = {}) {
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const payload = b64({ iss: 'https://issuer.test', aud: 'le-studio', sub, exp, ...claims });
  const input = `${header}.${payload}`;
  const signature = createHmac('sha256', signingKey).update(input).digest('base64url');
  return `${input}.${signature}`;
}

function env(overrides = {}) {
  return {
    NODE_ENV: 'production',
    RELAY_MODE: 'production',
    GROQ_API_KEY: 'provider-fixture-value-2026',
    ALLOWED_ORIGINS: 'https://studio.example.com',
    AUTH_ISSUER: 'https://issuer.test',
    AUTH_AUDIENCE: 'le-studio',
    AUTH_JWT_SECRET: SIGNING_MATERIAL,
    RELAY_QUOTA_NAMESPACE_SECRET: 'fixture-quota-namespace-material-for-tests-only',
    RELAY_RATE_LIMIT_PER_MINUTE: '100',
    GROQ_DAILY_LIMIT_AUTHED: '120',
    ...overrides,
  };
}

const validBody = Object.freeze({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Say bonjour.' }],
  temperature: 0.2,
  response_format: { type: 'json_object' },
  max_tokens: 32,
});

function request({ body = validBody, path = '/api/groq/chat/completions', auth = token(), origin = 'https://studio.example.com', contentType = 'application/json', contentLength } = {}) {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    method: 'POST',
    url: path,
    headers: {
      origin,
      authorization: auth ? `Bearer ${auth}` : undefined,
      'content-type': contentType,
      'content-length': contentLength === undefined ? String(Buffer.byteLength(serialized)) : String(contentLength),
    },
    body: typeof body === 'string' ? body : body,
  };
}

function recorder() {
  const headers = {};
  let responseBody;
  return {
    headers,
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = String(value); },
    status(status) { this.statusCode = status; return this; },
    json(body) { responseBody = body; return body; },
    end(body = '') {
      if (body) {
        try { responseBody = JSON.parse(body); } catch { responseBody = body; }
      }
      return body;
    },
    get body() { return responseBody; },
  };
}

function provider({ status = 200, body = { choices: [{ message: { content: '{"ok":true}' } }] } } = {}) {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetchImpl, get calls() { return calls; } };
}

async function run({ environment = env(), req = request(), fetchImpl = provider().fetchImpl, store = createInMemoryQuotaStore(), logger = () => {} } = {}) {
  const handler = createRelayHandler({ environment, env: environment, fetchImpl, store, logger, now: () => NOW });
  const res = recorder();
  await handler(req, res);
  return res;
}

test('rejects anonymous production requests before the provider is contacted', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ auth: null }) });
  assert.equal(res.statusCode, 401);
  assert.equal(upstream.calls, 0);
});

test('rejects forged JWTs even when the token has valid claims', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ auth: token({ signingKey: OTHER_SIGNING_MATERIAL }) }) });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'unauthorized');
  assert.equal(upstream.calls, 0);
});

test('rejects unsupported relay paths and never constructs an arbitrary upstream URL', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ path: '/api/groq/models' }) });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'route_not_allowed');
  assert.equal(upstream.calls, 0);
});

test('rejects query-string path overrides', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ path: '/api/groq?path=chat/completions' }) });
  assert.equal(res.statusCode, 404);
  assert.equal(upstream.calls, 0);
});

test('enforces the body limit before parsing a huge payload', async () => {
  const upstream = provider();
  const res = await run({
    environment: env({ RELAY_MAX_BODY_BYTES: '1024' }),
    fetchImpl: upstream.fetchImpl,
    req: request({ body: { ...validBody, messages: [{ role: 'user', content: 'x'.repeat(2_000) }] } }),
  });
  assert.equal(res.statusCode, 413);
  assert.equal(upstream.calls, 0);
});

test('rejects malicious or ambiguous content types', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ contentType: 'application/json-patch+json' }) });
  assert.equal(res.statusCode, 415);
  assert.equal(upstream.calls, 0);
});

test('rejects disallowed origins without reflecting them in CORS headers', async () => {
  const upstream = provider();
  const res = await run({ fetchImpl: upstream.fetchImpl, req: request({ origin: 'https://evil.example' }) });
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.equal(upstream.calls, 0);
});

test('fails closed when GROQ_API_KEY is missing', async () => {
  const upstream = provider();
  const res = await run({ environment: env({ GROQ_API_KEY: '' }), fetchImpl: upstream.fetchImpl });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'relay_unavailable');
  assert.equal(upstream.calls, 0);
});

test('fails closed rather than falling back to memory when the production store is missing', async () => {
  const upstream = provider();
  const handler = createRelayHandler({ env: env(), fetchImpl: upstream.fetchImpl, now: () => NOW, logger: () => {} });
  const res = recorder();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(upstream.calls, 0);
});

test('uses one atomic durable EVAL command for Redis rate and quota accounting', async () => {
  let command;
  const store = createUpstashQuotaStore({
    url: 'https://redis.example',
    token: 'redis-fixture-value-2026',
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://redis.example/pipeline');
      command = JSON.parse(options.body)[0];
      return new Response(JSON.stringify([{ result: [1, 19, 119, 0, 'ok'] }]), { status: 200 });
    },
  });
  const result = await store.consume({ key: 'hashed-user-key', rateLimit: 20, dailyLimit: 120, nowMs: NOW });
  assert.equal(result.allowed, true);
  assert.equal(command[0], 'EVAL');
  assert.equal(command[2], '2');
  assert.match(command[1], /INCR/);
  assert.match(command[1], /EXPIRE/);
});

test('rejects schemas with unapproved models and excessive output tokens', async () => {
  const upstream = provider();
  const modelRes = await run({ fetchImpl: upstream.fetchImpl, req: request({ body: { ...validBody, model: 'https://attacker.example/steal' } }) });
  const tokenRes = await run({ fetchImpl: upstream.fetchImpl, req: request({ body: { ...validBody, max_tokens: 9_999 } }) });
  assert.equal(modelRes.statusCode, 400);
  assert.equal(modelRes.body.error, 'model_not_allowed');
  assert.equal(tokenRes.statusCode, 400);
  assert.equal(tokenRes.body.error, 'output_token_limit_exceeded');
  assert.equal(upstream.calls, 0);
});

test('atomically enforces the daily quota under concurrent requests', async () => {
  const upstream = provider();
  const store = createInMemoryQuotaStore();
  const handler = createRelayHandler({
    env: env({ GROQ_DAILY_LIMIT_AUTHED: '1' }),
    fetchImpl: async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return upstream.fetchImpl(...args);
    },
    store,
    now: () => NOW,
    logger: () => {},
  });
  const responses = await Promise.all(Array.from({ length: 12 }, () => {
    const res = recorder();
    return handler(request(), res).then(() => res);
  }));
  assert.equal(responses.filter((res) => res.statusCode === 200).length, 1);
  assert.equal(responses.filter((res) => res.statusCode === 429).length, 11);
  assert.equal(upstream.calls, 1);
  assert.match(QUOTA_SCRIPT, /INCR/);
  assert.match(QUOTA_SCRIPT, /EXPIRE/);
});

test('maps provider timeouts to a safe 504 response', async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const res = await run({ environment: env({ RELAY_PROVIDER_TIMEOUT_MS: '100' }), fetchImpl });
  assert.equal(res.statusCode, 504);
  assert.equal(res.body.error, 'provider_timeout');
});

test('maps provider failures without forwarding provider response content', async () => {
  const upstream = provider({ status: 500, body: { error: 'provider internal diagnostics' } });
  const res = await run({ fetchImpl: upstream.fetchImpl });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'provider_unavailable');
  assert.doesNotMatch(JSON.stringify(res.body), /provider internal diagnostics/);
});
