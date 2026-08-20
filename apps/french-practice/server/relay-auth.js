import {
  createHmac,
  createPublicKey,
  createVerify,
  timingSafeEqual,
} from 'node:crypto';

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid_base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function parseSegment(value) {
  const parsed = JSON.parse(decodeBase64Url(value).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_jwt_json');
  return parsed;
}

function equalBytes(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function audienceMatches(audience, expected) {
  return Array.isArray(audience) ? audience.includes(expected) : audience === expected;
}

function authFailure(code, status = 401) {
  return { ok: false, status, code };
}

class AuthUnavailable extends Error {}

function verifyWithKey(algorithm, signingInput, signature, key) {
  if (algorithm !== 'RS256') return false;
  const verifier = createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();
  return verifier.verify(key, signature);
}

function verifyHmac(signingInput, signature, secret) {
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  return equalBytes(expected, signature);
}

async function fetchJwks(config, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(config.auth.jwksUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new AuthUnavailable('jwks_http_error');
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > 512 * 1024) throw new AuthUnavailable('jwks_too_large');
    const json = JSON.parse(text);
    if (!Array.isArray(json.keys) || json.keys.length === 0) throw new AuthUnavailable('jwks_invalid');
    return json.keys;
  } catch (error) {
    if (error instanceof AuthUnavailable) throw error;
    throw new AuthUnavailable('jwks_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

function createJwksResolver(config, fetchImpl, logger) {
  let cached = null;
  let loading = null;
  const ttlMs = 5 * 60 * 1000;
  return async (kid) => {
    if (cached && cached.expiresAt > Date.now()) {
      const hit = cached.keys.find((key) => key.kid === kid);
      if (hit) return createPublicKey({ key: hit, format: 'jwk' });
    }
    if (!loading) {
      loading = fetchJwks(config, fetchImpl, 5_000).finally(() => { loading = null; });
    }
    let keys;
    try {
      keys = await loading;
    } catch {
      logger({ event: 'auth_key_provider_unavailable' });
      throw new AuthUnavailable('jwks_unavailable');
    }
    cached = { keys, expiresAt: Date.now() + ttlMs };
    const match = keys.find((key) => key.kid === kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256'));
    if (!match) throw new AuthUnavailable('jwks_key_not_found');
    try {
      return createPublicKey({ key: match, format: 'jwk' });
    } catch {
      throw new AuthUnavailable('jwks_key_invalid');
    }
  };
}

export function createAuthenticator(config, {
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  logger = () => {},
} = {}) {
  const resolveJwksKey = config.mode === 'production' && config.auth.jwksUrl
    ? createJwksResolver(config, fetchImpl, logger)
    : null;
  let publicKey = null;
  if (config.mode === 'production' && config.auth.publicKey) {
    try {
      publicKey = createPublicKey(config.auth.publicKey.replace(/\\n/g, '\n'));
    } catch {
      publicKey = null;
    }
  }

  return async function authenticate(req) {
    const rawHeader = req.headers?.authorization;
    if (typeof rawHeader !== 'string' || !/^Bearer [^\s]+$/.test(rawHeader)) {
      return authFailure('authorization_missing');
    }
    const token = rawHeader.slice('Bearer '.length);
    if (token.length > 8_192) return authFailure('authorization_too_large');

    if (config.mode === 'local') {
      const valid = equalBytes(Buffer.from(token), Buffer.from(config.auth.localToken));
      return valid
        ? { ok: true, userId: config.auth.localUserId, authType: 'local' }
        : authFailure('authorization_invalid');
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3 || parts.some((part) => !part)) return authFailure('jwt_malformed');
      const header = parseSegment(parts[0]);
      const claims = parseSegment(parts[1]);
      const signature = decodeBase64Url(parts[2]);
      if ((header.typ !== undefined && header.typ !== 'JWT') || typeof header.alg !== 'string') return authFailure('jwt_header_invalid');

      const signingInput = `${parts[0]}.${parts[1]}`;
      let verified = false;
      if (config.auth.secret) {
        verified = header.alg === 'HS256' && verifyHmac(signingInput, signature, config.auth.secret);
      } else {
        let key = publicKey;
        if (!key && resolveJwksKey) key = await resolveJwksKey(header.kid);
        if (key) verified = verifyWithKey(header.alg, signingInput, signature, key);
      }
      if (!verified) return authFailure('jwt_signature_invalid');

      const nowSeconds = Math.floor(Number(now()) / 1000);
      const skew = config.authClockSkewSeconds;
      if (claims.iss !== config.auth.issuer) return authFailure('jwt_issuer_invalid');
      if (!audienceMatches(claims.aud, config.auth.audience)) return authFailure('jwt_audience_invalid');
      if (typeof claims.sub !== 'string' || !claims.sub.trim() || claims.sub.length > 256) return authFailure('jwt_subject_invalid');
      if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds - skew) return authFailure('jwt_expired');
      if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > nowSeconds + skew)) {
        return authFailure('jwt_not_active');
      }
      if (claims.iat !== undefined && (!Number.isFinite(claims.iat) || claims.iat > nowSeconds + skew)) {
        return authFailure('jwt_issued_in_future');
      }
      return { ok: true, userId: claims.sub, authType: 'jwt' };
    } catch (error) {
      if (error instanceof AuthUnavailable) return authFailure('auth_provider_unavailable', 503);
      return authFailure('jwt_invalid');
    }
  };
}
