/*
 * Production requires:
 *   RELAY_MODE=production, GROQ_API_KEY, ALLOWED_ORIGINS
 *   AUTH_ISSUER + AUTH_AUDIENCE + one of AUTH_JWT_SECRET, AUTH_PUBLIC_KEY,
 *   or AUTH_JWKS_URL
 *   RELAY_QUOTA_NAMESPACE_SECRET and UPSTASH_REDIS_REST_URL/TOKEN
 *
 * Local mode is explicit (RELAY_MODE=local, NODE_ENV != production) and
 * requires LOCAL_RELAY_TOKEN. It is the only mode that uses memory quotas.
 */

import { createHash, randomUUID } from 'node:crypto';

import { loadRelayConfig } from './relay-config.js';
import { createAuthenticator } from './relay-auth.js';
import { createInMemoryQuotaStore, createUpstashQuotaStore, quotaIdentityKey } from './relay-quota.js';
import {
  mediaType,
  RELAY_ROUTES,
  resolveRelayRoute,
  validateAudioRequest,
  validateChatRequest,
} from './relay-validation.js';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

function requestId() {
  try { return randomUUID(); } catch { return createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16); }
}

function header(req, name) {
  const value = req.headers?.[name.toLowerCase()] ?? req.headers?.[name];
  return Array.isArray(value) ? null : value;
}

function hasHeader(req, name) {
  const headers = req.headers || {};
  return Object.prototype.hasOwnProperty.call(headers, name.toLowerCase())
    || Object.prototype.hasOwnProperty.call(headers, name);
}

function defaultLogger(entry) {
  console.info(JSON.stringify(entry));
}

function setHeader(res, name, value) {
  if (typeof res.setHeader === 'function') res.setHeader(name, value);
}

function sendJson(res, status, body) {
  if (typeof res.status === 'function') {
    const response = res.status(status);
    if (typeof response.json === 'function') return response.json(body);
    if (typeof response.end === 'function') return response.end(JSON.stringify(body));
  }
  res.statusCode = status;
  setHeader(res, 'Content-Type', 'application/json; charset=utf-8');
  return typeof res.end === 'function' ? res.end(JSON.stringify(body)) : undefined;
}

function sendEmpty(res, status) {
  if (typeof res.status === 'function') {
    const response = res.status(status);
    if (typeof response.end === 'function') return response.end();
    if (typeof response.send === 'function') return response.send('');
  }
  res.statusCode = status;
  return typeof res.end === 'function' ? res.end() : undefined;
}

function errorResponse(res, status, code, retryAfter) {
  if (retryAfter) setHeader(res, 'Retry-After', String(Math.ceil(retryAfter)));
  return sendJson(res, status, { error: code });
}

function applyBaseHeaders(res, origin, allowedOrigins) {
  setHeader(res, 'Cache-Control', 'no-store');
  setHeader(res, 'Vary', 'Origin');
  if (origin && allowedOrigins.includes(origin)) {
    setHeader(res, 'Access-Control-Allow-Origin', origin);
    setHeader(res, 'Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    setHeader(res, 'Access-Control-Allow-Headers', 'Content-Type, Authorization');
    setHeader(res, 'Access-Control-Max-Age', '600');
  }
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

function contentLengthTooLarge(req, maxBytes) {
  const raw = header(req, 'content-length');
  if (raw === undefined || raw === null || raw === '') return false;
  if (!/^\d+$/.test(String(raw))) return true;
  return Number(raw) > maxBytes;
}

async function readBody(req, maxBytes) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.byteLength > maxBytes) return { ok: false, code: 'request_too_large' };
      return { ok: true, raw: req.body.toString('utf8') };
    }
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBytes) return { ok: false, code: 'request_too_large' };
      return { ok: true, raw: req.body };
    }
    let serialized;
    try { serialized = JSON.stringify(req.body); } catch { return { ok: false, code: 'request_schema_invalid' }; }
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) return { ok: false, code: 'request_too_large' };
    return { ok: true, parsed: req.body };
  }

  if (!req || typeof req[Symbol.asyncIterator] !== 'function') return { ok: true, raw: '' };
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) return { ok: false, code: 'request_too_large' };
    chunks.push(buffer);
  }
  return { ok: true, raw: Buffer.concat(chunks).toString('utf8') };
}

function parseJsonBody(body) {
  if (body.parsed !== undefined) return body.parsed;
  if (!body.raw || !body.raw.trim()) return null;
  try { return JSON.parse(body.raw); } catch { return undefined; }
}

function addQuotaHeaders(res, config, quota, nowMs) {
  setHeader(res, 'X-RateLimit-Limit', String(config.dailyLimit));
  setHeader(res, 'X-RateLimit-Remaining', String(quota.dailyRemaining));
  setHeader(res, 'X-RateLimit-Reset', String(Math.floor(Number(nowMs) / 1000) + Math.max(0, quota.retryAfterSeconds || 0)));
  setHeader(res, 'X-Relay-RateLimit-Limit', String(config.rateLimitPerMinute));
  setHeader(res, 'X-Relay-RateLimit-Remaining', String(quota.rateRemaining));
}

function mapProviderError(status) {
  if (status === 400 || status === 422) return { status: 400, code: 'provider_rejected_request' };
  if (status === 401 || status === 403) return { status: 503, code: 'relay_provider_unavailable' };
  if (status === 429) return { status: 429, code: 'provider_rate_limited' };
  return { status: 502, code: 'provider_unavailable' };
}

function providerSignal(timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  return { controller, timer, didTimeout: () => timedOut };
}

function audioExtension(mimeType) {
  if (mimeType === 'audio/mp4') return 'mp4';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/mpeg') return 'mp3';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  return 'webm';
}

async function callProvider(route, body, config, fetchImpl) {
  const signal = providerSignal(config.providerTimeoutMs);
  let requestBody = JSON.stringify(body);
  const headers = {
    Authorization: `Bearer ${config.groqKey}`,
    Accept: 'application/json',
  };
  if (route === RELAY_ROUTES.chat) {
    headers['Content-Type'] = 'application/json';
  } else {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from(body.audio_base64, 'base64')], { type: body.mime_type }), `recording.${audioExtension(body.mime_type)}`);
    form.append('model', body.model);
    if (body.language) form.append('language', body.language);
    form.append('response_format', 'json');
    requestBody = form;
  }
  try {
    const response = await fetchImpl(`${GROQ_BASE}/${route.upstreamPath}`, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: signal.controller.signal,
    });
    if (signal.didTimeout()) {
      const error = new Error('provider_timeout');
      error.code = 'PROVIDER_TIMEOUT';
      throw error;
    }
    return response;
  } catch (error) {
    if (signal.didTimeout() || error?.code === 'PROVIDER_TIMEOUT') {
      const timeout = new Error('provider_timeout');
      timeout.code = 'PROVIDER_TIMEOUT';
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(signal.timer);
  }
}

async function readProviderJson(response, maxBytes) {
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    const error = new Error('provider_response_too_large');
    error.code = 'PROVIDER_RESPONSE_TOO_LARGE';
    throw error;
  }
  let payload;
  try { payload = JSON.parse(text); } catch {
    const error = new Error('provider_response_invalid');
    error.code = 'PROVIDER_RESPONSE_INVALID';
    throw error;
  }
  // Structured-output validation: ensure provider response is a plausible
  // Groq/OpenAI shape and does not leak provider secrets, and cap deep size.
  if (payload && typeof payload === 'object') {
    // Never forward provider headers or error details that could leak internals
    // Do a shallow shape check so a truncated / HTML response is rejected.
    const isChat = Array.isArray(payload.choices);
    const isTranscription = typeof payload.text === 'string';
    const isModels = Array.isArray(payload.data);
    if (!isChat && !isTranscription && !isModels && !payload.object) {
      const error = new Error('provider_response_invalid');
      error.code = 'PROVIDER_RESPONSE_INVALID';
      throw error;
    }
    if (isChat) {
      for (const c of payload.choices.slice(0, 3)) {
        if (!c || typeof c !== 'object' || !c.message || typeof c.message.content !== 'string') {
          const error = new Error('provider_response_invalid');
          error.code = 'PROVIDER_RESPONSE_INVALID';
          throw error;
        }
        // Content size per choice already bounded by upstream max_output_tokens,
        // but enforce an additional hard cap to avoid relay amplification.
        if (Buffer.byteLength(c.message.content, 'utf8') > 64 * 1024) {
          const error = new Error('provider_response_too_large');
          error.code = 'PROVIDER_RESPONSE_TOO_LARGE';
          throw error;
        }
      }
    }
  }
  return payload;
}

function createRuntime(options = {}) {
  const env = options.env || process.env;
  const configResult = options.configResult || loadRelayConfig(env, { allowInjectedStore: Boolean(options.store) });
  const config = configResult.config;
  const logger = typeof options.logger === 'function' ? options.logger : defaultLogger;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => Date.now());
  const store = options.store || (configResult.ok
    ? (config.mode === 'local'
      ? createInMemoryQuotaStore()
      : createUpstashQuotaStore({ url: config.redisUrl, token: config.redisToken, fetchImpl }))
    : null);
  const authenticate = options.authenticate || (configResult.ok ? createAuthenticator(config, { fetchImpl, now, logger }) : null);

  async function handle(req, res) {
    const started = now();
    const id = requestId();
    const origin = header(req, 'origin');
    applyBaseHeaders(res, origin, config.allowedOrigins || []);
    const route = resolveRelayRoute(req);

    if ((hasHeader(req, 'origin') && !origin) || !isAllowedOrigin(origin, config.allowedOrigins || [])) {
      logger({ event: 'request_rejected', requestId: id, reason: 'origin_not_allowed' });
      return errorResponse(res, 403, 'origin_not_allowed');
    }
    if (!configResult.ok) {
      logger({ event: 'relay_misconfigured', requestId: id, issueCount: configResult.issues.length });
      return errorResponse(res, 503, 'relay_unavailable');
    }
    if (!route) {
      logger({ event: 'request_rejected', requestId: id, reason: 'route_not_allowed' });
      return errorResponse(res, 404, 'route_not_allowed');
    }
    if (req.method === 'OPTIONS') {
      if (!origin) return errorResponse(res, 403, 'origin_required');
      return sendEmpty(res, 204);
    }
    if (route === RELAY_ROUTES.health) {
      if (req.method !== 'GET') return errorResponse(res, 405, 'method_not_allowed');
      const auth = await authenticate(req);
      if (!auth.ok) return errorResponse(res, auth.status || 401, 'unauthorized');
      return sendJson(res, 200, { ok: true, relay: 'groq' });
    }
    if (req.method !== 'POST') return errorResponse(res, 405, 'method_not_allowed');
    if (contentLengthTooLarge(req, config.maxBodyBytes)) return errorResponse(res, 413, 'request_too_large');

    const type = mediaType(header(req, 'content-type'));
    if (type !== 'application/json') return errorResponse(res, 415, 'content_type_not_supported');

    const auth = await authenticate(req);
    if (!auth.ok) {
      logger({ event: 'request_rejected', requestId: id, reason: auth.code || 'unauthorized' });
      return errorResponse(res, auth.status || 401, 'unauthorized');
    }

    const rawBody = await readBody(req, config.maxBodyBytes);
    if (!rawBody.ok) return errorResponse(res, 413, rawBody.code);
    const body = parseJsonBody(rawBody);
    if (body === undefined || body === null) return errorResponse(res, 400, 'request_schema_invalid');

    const validation = route === RELAY_ROUTES.chat
      ? validateChatRequest(body, config)
      : validateAudioRequest(body, config);
    if (!validation.ok) return errorResponse(res, 400, validation.code);

    const key = quotaIdentityKey(config.quotaNamespaceSecret, auth.userId);
    let quota;
    try {
      quota = await store.consume({
        key,
        rateLimit: config.rateLimitPerMinute,
        dailyLimit: config.dailyLimit,
        nowMs: Number(now()),
      });
    } catch {
      logger({ event: 'quota_store_unavailable', requestId: id });
      return errorResponse(res, 503, 'relay_unavailable');
    }
    addQuotaHeaders(res, config, quota, Number(now()));
    if (!quota.allowed) {
      logger({ event: 'request_rejected', requestId: id, reason: quota.reason === 'rate' ? 'rate_limited' : 'daily_quota_exhausted' });
      return errorResponse(res, 429, quota.reason === 'rate' ? 'rate_limited' : 'daily_quota_exhausted', quota.retryAfterSeconds);
    }

    let upstream;
    try {
      upstream = await callProvider(route, validation.body, config, fetchImpl);
    } catch (error) {
      const isTimeout = error?.code === 'PROVIDER_TIMEOUT';
      const isOversize = error?.code === 'PROVIDER_RESPONSE_TOO_LARGE';
      logger({ event: isTimeout ? 'provider_timeout' : 'provider_fetch_error', requestId: id, route: route.operation });
      return errorResponse(res, isTimeout ? 504 : 502, isOversize ? 'provider_response_too_large' : (isTimeout ? 'provider_timeout' : 'provider_unavailable'));
    }

    if (!upstream || !upstream.ok) {
      const mapped = mapProviderError(upstream?.status);
      logger({ event: 'provider_rejected', requestId: id, route: route.operation, providerStatus: Number(upstream?.status) || 0 });
      return errorResponse(res, mapped.status, mapped.code, mapped.status === 429 ? 5 : 0);
    }
    try {
      const payload = await readProviderJson(upstream, config.maxResponseBytes);
      logger({ event: 'request_completed', requestId: id, route: route.operation, status: 200, latencyMs: Math.max(0, Number(now()) - Number(started)) });
      return sendJson(res, 200, payload);
    } catch (error) {
      logger({ event: 'provider_response_invalid', requestId: id, route: route.operation });
      return errorResponse(res, 502, error?.code === 'PROVIDER_RESPONSE_TOO_LARGE' ? 'provider_response_too_large' : 'provider_unavailable');
    }
  }

  return { handle, configResult };
}

export function createRelayHandler(options = {}) {
  return createRuntime(options).handle;
}

export { loadRelayConfig } from './relay-config.js';
export { createInMemoryQuotaStore, createUpstashQuotaStore, QUOTA_SCRIPT } from './relay-quota.js';
export { RELAY_ROUTES, resolveRelayRoute, validateAudioRequest, validateChatRequest } from './relay-validation.js';

let defaultRuntime;
let defaultFingerprint = '';

function defaultConfigFingerprint(env) {
  return [
    env.RELAY_MODE, env.NODE_ENV, env.GROQ_API_KEY, env.ALLOWED_ORIGINS, env.ALLOWED_ORIGIN,
    env.AUTH_ISSUER, env.AUTH_AUDIENCE, env.AUTH_JWT_SECRET, env.AUTH_PUBLIC_KEY, env.AUTH_JWKS_URL,
    env.RELAY_QUOTA_NAMESPACE_SECRET, env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN,
  ].map((value) => String(value || '')).join('\u0000');
}

export default async function handler(req, res) {
  const fingerprint = defaultConfigFingerprint(process.env);
  if (!defaultRuntime || defaultFingerprint !== fingerprint) {
    defaultRuntime = createRuntime();
    defaultFingerprint = fingerprint;
  }
  return defaultRuntime.handle(req, res);
}
