import { createHash } from 'node:crypto';

const QUOTA_SCRIPT = `
local rate_count = tonumber(redis.call('GET', KEYS[1]) or '0')
local daily_count = tonumber(redis.call('GET', KEYS[2]) or '0')
local rate_limit = tonumber(ARGV[1])
local daily_limit = tonumber(ARGV[2])
local daily_ttl = tonumber(ARGV[3])

if rate_count >= rate_limit then
  return {0, 0, math.max(0, daily_limit - daily_count), 60, 'rate'}
end
if daily_count >= daily_limit then
  return {0, math.max(0, rate_limit - rate_count), 0, daily_ttl, 'daily'}
end

local new_rate = redis.call('INCR', KEYS[1])
if new_rate == 1 then redis.call('EXPIRE', KEYS[1], 120) end
local new_daily = redis.call('INCR', KEYS[2])
if new_daily == 1 then redis.call('EXPIRE', KEYS[2], daily_ttl) end
return {1, math.max(0, rate_limit - new_rate), math.max(0, daily_limit - new_daily), 0, 'ok'}
`;

function dayStamp(nowMs) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function secondsUntilTomorrow(nowMs) {
  const next = new Date(nowMs);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - nowMs) / 1000));
}

function normalizeResult(result) {
  if (!Array.isArray(result) || result.length < 5) throw new Error('quota_store_invalid_result');
  return {
    allowed: Number(result[0]) === 1,
    rateRemaining: Math.max(0, Number(result[1]) || 0),
    dailyRemaining: Math.max(0, Number(result[2]) || 0),
    retryAfterSeconds: Math.max(0, Number(result[3]) || 0),
    reason: String(result[4] || 'unknown'),
  };
}

function redisEndpoint(url) {
  const normalized = String(url).replace(/\/$/, '');
  return normalized.endsWith('/pipeline') ? normalized : `${normalized}/pipeline`;
}

export function createUpstashQuotaStore({ url, token, fetchImpl = globalThis.fetch, timeoutMs = 5_000 }) {
  const endpoint = redisEndpoint(url);
  return {
    async consume({ key, rateLimit, dailyLimit, nowMs = Date.now() }) {
      const day = dayStamp(nowMs);
      const minute = Math.floor(nowMs / 60_000);
      const rateKey = `le-studio:groq:rate:${key}:${minute}`;
      const dailyKey = `le-studio:groq:daily:${key}:${day}`;
      const command = [
        'EVAL',
        QUOTA_SCRIPT,
        '2',
        rateKey,
        dailyKey,
        String(rateLimit),
        String(dailyLimit),
        String(Math.max(86_400, secondsUntilTomorrow(nowMs) + 86_400)),
      ];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([command]),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('quota_store_http_error');
        const payload = await response.json();
        const item = Array.isArray(payload) ? payload[0] : null;
        if (!item || item.error) throw new Error('quota_store_command_error');
        return normalizeResult(item.result);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createInMemoryQuotaStore() {
  const buckets = new Map();
  return {
    async consume({ key, rateLimit, dailyLimit, nowMs = Date.now() }) {
      const day = dayStamp(nowMs);
      const minute = Math.floor(nowMs / 60_000);
      let bucket = buckets.get(key);
      if (!bucket || bucket.day !== day || bucket.minute !== minute) {
        bucket = { day, minute, rate: 0, daily: bucket?.day === day ? bucket.daily : 0 };
        buckets.set(key, bucket);
      }
      if (bucket.rate >= rateLimit) {
        return { allowed: false, rateRemaining: 0, dailyRemaining: Math.max(0, dailyLimit - bucket.daily), retryAfterSeconds: 60, reason: 'rate' };
      }
      if (bucket.daily >= dailyLimit) {
        return { allowed: false, rateRemaining: Math.max(0, rateLimit - bucket.rate), dailyRemaining: 0, retryAfterSeconds: secondsUntilTomorrow(nowMs), reason: 'daily' };
      }
      bucket.rate += 1;
      bucket.daily += 1;
      return { allowed: true, rateRemaining: Math.max(0, rateLimit - bucket.rate), dailyRemaining: Math.max(0, dailyLimit - bucket.daily), retryAfterSeconds: 0, reason: 'ok' };
    },
  };
}

export function quotaIdentityKey(namespaceSecret, userId) {
  return createHash('sha256').update(`${namespaceSecret}:${userId}`).digest('hex');
}

export { QUOTA_SCRIPT };
