import { createPublicKey } from 'node:crypto';

const DEFAULT_ORIGINS_LOCAL = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const DEFAULTS = Object.freeze({
  dailyLimit: 120,
  rateLimitPerMinute: 20,
  maxBodyBytes: 8 * 1024 * 1024,
  maxResponseBytes: 2 * 1024 * 1024,
  maxInputTokens: 8_192,
  maxOutputTokens: 1_024,
  maxImageBytes: 4 * 1024 * 1024,
  maxAudioBytes: 6 * 1024 * 1024,
  providerTimeoutMs: 30_000,
  authClockSkewSeconds: 30,
});

function positiveInt(env, name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === '') return { value: fallback };
  if (!/^\d+$/.test(String(raw))) return { error: `${name}_invalid` };
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) return { error: `${name}_invalid` };
  return { value };
}

function parseOrigins(raw, mode, issues) {
  const value = raw === undefined || raw === ''
    ? (mode === 'local' ? DEFAULT_ORIGINS_LOCAL.join(',') : '')
    : String(raw);
  const origins = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!origins.length) {
    issues.push('allowed_origins_missing');
    return [];
  }
  const normalized = [];
  for (const origin of origins) {
    if (origin === '*') {
      issues.push('wildcard_origin_forbidden');
      continue;
    }
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
        issues.push('allowed_origin_invalid');
        continue;
      }
      if (mode === 'production' && parsed.protocol !== 'https:') {
        issues.push('production_origin_must_use_https');
        continue;
      }
      normalized.push(parsed.origin);
    } catch {
      issues.push('allowed_origin_invalid');
    }
  }
  return [...new Set(normalized)];
}

function parseSecret(raw, name, issues) {
  const value = String(raw || '').trim();
  if (!value) {
    issues.push(`${name}_missing`);
    return '';
  }
  if (value.length < 32) issues.push(`${name}_too_short`);
  return value;
}

function parseAuth(env, mode, issues) {
  if (mode === 'local') {
    const token = String(env.LOCAL_RELAY_TOKEN || env.RELAY_LOCAL_TOKEN || '').trim();
    if (!token) issues.push('local_relay_token_missing');
    if (token && token.length < 16) issues.push('local_relay_token_too_short');
    return {
      localToken: token,
      localUserId: String(env.LOCAL_RELAY_USER_ID || 'local-developer').trim() || 'local-developer',
    };
  }

  const issuer = String(env.AUTH_ISSUER || '').trim();
  const audience = String(env.AUTH_AUDIENCE || '').trim();
  if (!issuer) issues.push('auth_issuer_missing');
  if (!audience) issues.push('auth_audience_missing');
  try {
    if (issuer && new URL(issuer).protocol !== 'https:') issues.push('auth_issuer_must_use_https');
  } catch {
    if (issuer) issues.push('auth_issuer_invalid');
  }

  const secret = env.AUTH_JWT_SECRET ? parseSecret(env.AUTH_JWT_SECRET, 'auth_jwt_secret', issues) : '';
  const publicKey = String(env.AUTH_PUBLIC_KEY || '').trim();
  const jwksUrl = String(env.AUTH_JWKS_URL || '').trim();
  if (publicKey && jwksUrl) issues.push('multiple_auth_key_sources');
  if (!secret && !publicKey && !jwksUrl) issues.push('auth_key_source_missing');
  if (jwksUrl) {
    try {
      const parsed = new URL(jwksUrl);
      if (parsed.protocol !== 'https:') issues.push('auth_jwks_url_must_use_https');
    } catch {
      issues.push('auth_jwks_url_invalid');
    }
  }
  if (publicKey && !/BEGIN (?:PUBLIC KEY|RSA PUBLIC KEY)/.test(publicKey)) {
    issues.push('auth_public_key_invalid');
  } else if (publicKey) {
    try {
      createPublicKey(publicKey.replace(/\\n/g, '\n'));
    } catch {
      issues.push('auth_public_key_invalid');
    }
  }
  return { issuer, audience, secret, publicKey, jwksUrl };
}

export function loadRelayConfig(env = process.env, { allowInjectedStore = false } = {}) {
  const mode = String(env.RELAY_MODE || (env.NODE_ENV === 'production' ? 'production' : 'local')).trim().toLowerCase();
  const issues = [];
  if (!['production', 'local'].includes(mode)) issues.push('relay_mode_invalid');
  if (env.NODE_ENV === 'production' && mode !== 'production') issues.push('production_requires_production_mode');

  const groqKey = String(env.GROQ_API_KEY || '').trim();
  if (!groqKey) issues.push('groq_api_key_missing');
  if (groqKey.length > 512) issues.push('groq_api_key_invalid');

  const allowedOrigins = parseOrigins(env.ALLOWED_ORIGINS ?? env.ALLOWED_ORIGIN, mode, issues);
  const auth = parseAuth(env, mode, issues);

  const daily = positiveInt(env, 'GROQ_DAILY_LIMIT_AUTHED', DEFAULTS.dailyLimit, { max: 1_000_000 });
  const rate = positiveInt(env, 'RELAY_RATE_LIMIT_PER_MINUTE', DEFAULTS.rateLimitPerMinute, { max: 100_000 });
  const body = positiveInt(env, 'RELAY_MAX_BODY_BYTES', DEFAULTS.maxBodyBytes, { min: 1_024, max: 16 * 1024 * 1024 });
  const response = positiveInt(env, 'RELAY_MAX_RESPONSE_BYTES', DEFAULTS.maxResponseBytes, { min: 1_024, max: 16 * 1024 * 1024 });
  const inputTokens = positiveInt(env, 'RELAY_MAX_INPUT_TOKENS', DEFAULTS.maxInputTokens, { max: 32_000 });
  const outputTokens = positiveInt(env, 'RELAY_MAX_OUTPUT_TOKENS', DEFAULTS.maxOutputTokens, { max: 8_192 });
  const image = positiveInt(env, 'RELAY_MAX_IMAGE_BYTES', DEFAULTS.maxImageBytes, { min: 1_024, max: 8 * 1024 * 1024 });
  const audio = positiveInt(env, 'RELAY_MAX_AUDIO_BYTES', DEFAULTS.maxAudioBytes, { min: 1_024, max: 12 * 1024 * 1024 });
  const timeout = positiveInt(env, 'RELAY_PROVIDER_TIMEOUT_MS', DEFAULTS.providerTimeoutMs, { min: 100, max: 60_000 });
  const skew = positiveInt(env, 'AUTH_CLOCK_SKEW_SECONDS', DEFAULTS.authClockSkewSeconds, { min: 0, max: 300 });
  for (const result of [daily, rate, body, response, inputTokens, outputTokens, image, audio, timeout, skew]) {
    if (result.error) issues.push(result.error);
  }

  const quotaNamespaceSecret = mode === 'local'
    ? String(env.RELAY_QUOTA_NAMESPACE_SECRET || 'local-only-quota-namespace')
    : parseSecret(env.RELAY_QUOTA_NAMESPACE_SECRET, 'relay_quota_namespace_secret', issues);

  const redisUrl = String(env.UPSTASH_REDIS_REST_URL || '').trim();
  const redisToken = String(env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (mode === 'production' && !allowInjectedStore) {
    if (!redisUrl) issues.push('upstash_url_missing');
    if (!redisToken) issues.push('upstash_token_missing');
    try {
      if (redisUrl && new URL(redisUrl).protocol !== 'https:') issues.push('upstash_url_must_use_https');
    } catch {
      if (redisUrl) issues.push('upstash_url_invalid');
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    config: {
      mode,
      groqKey,
      allowedOrigins,
      auth,
      dailyLimit: daily.value,
      rateLimitPerMinute: rate.value,
      maxBodyBytes: body.value,
      maxResponseBytes: response.value,
      maxInputTokens: inputTokens.value,
      maxOutputTokens: outputTokens.value,
      maxImageBytes: image.value,
      maxAudioBytes: audio.value,
      providerTimeoutMs: timeout.value,
      authClockSkewSeconds: skew.value,
      quotaNamespaceSecret,
      redisUrl,
      redisToken,
    },
  };
}

export const relayDefaults = DEFAULTS;
