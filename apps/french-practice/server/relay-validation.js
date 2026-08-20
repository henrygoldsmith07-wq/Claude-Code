export const RELAY_ROUTES = Object.freeze({
  chat: Object.freeze({ operation: 'chat', upstreamPath: 'chat/completions' }),
  audio: Object.freeze({ operation: 'audio', upstreamPath: 'audio/transcriptions' }),
  health: Object.freeze({ operation: 'health' }),
});

export const MODEL_LIMITS = Object.freeze({
  'llama-3.1-8b-instant': Object.freeze({ inputTokens: 8_192, outputTokens: 1_024 }),
  'meta-llama/llama-4-scout-17b-16e-instruct': Object.freeze({ inputTokens: 8_192, outputTokens: 1_024 }),
  'whisper-large-v3-turbo': Object.freeze({ inputTokens: 0, outputTokens: 0 }),
});

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function onlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function textSize(value) {
  return typeof value === 'string' ? value.length : 0;
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function imageBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

function isBase64(value) {
  return value.length > 0
    && value.length % 4 === 0
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function validateMessageContent(content, { vision, maxImageBytes }) {
  if (typeof content === 'string') {
    if (!content.trim() || textSize(content) > 20_000) return { ok: false, code: 'message_content_invalid' };
    return { ok: true, tokens: estimateTokens(content) };
  }
  if (!vision || !Array.isArray(content) || content.length < 1 || content.length > 4) {
    return { ok: false, code: 'message_content_invalid' };
  }
  let tokens = 0;
  for (const part of content) {
    if (!isPlainObject(part) || !['text', 'image_url'].includes(part.type)) return { ok: false, code: 'message_content_invalid' };
    if (part.type === 'text') {
      if (typeof part.text !== 'string' || !part.text.trim() || part.text.length > 20_000) return { ok: false, code: 'message_content_invalid' };
      tokens += estimateTokens(part.text);
    } else {
      if (!isPlainObject(part.image_url) || !onlyKeys(part.image_url, ['url']) || typeof part.image_url.url !== 'string') {
        return { ok: false, code: 'image_invalid' };
      }
      const url = part.image_url.url;
      const imageMatch = url.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,(.*)$/);
      if (!imageMatch || !isBase64(imageMatch[1])) return { ok: false, code: 'image_invalid' };
      if (imageBytes(url) > maxImageBytes) return { ok: false, code: 'image_too_large' };
      tokens += 256;
    }
  }
  return { ok: true, tokens };
}

export function resolveRelayRoute(req) {
  const rawUrl = String(req.url || '/api/groq');
  let parsed;
  try {
    parsed = new URL(rawUrl, 'http://relay.invalid');
  } catch {
    return null;
  }
  if (parsed.search || req.query?.path !== undefined) return null;
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const routes = new Map([
    ['/api/groq', RELAY_ROUTES.chat],
    ['/api/groq/chat/completions', RELAY_ROUTES.chat],
    ['/api/groq/audio/transcriptions', RELAY_ROUTES.audio],
    ['/api/groq/healthz', RELAY_ROUTES.health],
    ['/chat/completions', RELAY_ROUTES.chat],
    ['/audio/transcriptions', RELAY_ROUTES.audio],
    ['/healthz', RELAY_ROUTES.health],
  ]);
  return routes.get(pathname) || null;
}

export function mediaType(value) {
  if (typeof value !== 'string') return '';
  const parts = value.split(';').map((part) => part.trim().toLowerCase());
  if (!['application/json'].includes(parts[0])) return '';
  if (parts.slice(1).some((part) => part && !/^charset=utf-8$/.test(part))) return '';
  return parts[0];
}

export function validateChatRequest(body, config) {
  if (!isPlainObject(body) || !onlyKeys(body, ['model', 'messages', 'temperature', 'response_format', 'max_tokens'])) {
    return { ok: false, code: 'request_schema_invalid' };
  }
  const limits = MODEL_LIMITS[body.model];
  if (!limits || body.model === 'whisper-large-v3-turbo') return { ok: false, code: 'model_not_allowed' };
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 32) {
    return { ok: false, code: 'messages_invalid' };
  }
  let inputTokens = 0;
  for (const message of body.messages) {
    if (!isPlainObject(message) || !onlyKeys(message, ['role', 'content']) || !['system', 'user', 'assistant'].includes(message.role)) {
      return { ok: false, code: 'messages_invalid' };
    }
    const content = validateMessageContent(message.content, {
      vision: body.model === 'meta-llama/llama-4-scout-17b-16e-instruct' && message.role === 'user',
      maxImageBytes: config.maxImageBytes,
    });
    if (!content.ok) return content;
    inputTokens += content.tokens;
  }
  const maxInputTokens = Math.min(config.maxInputTokens, limits.inputTokens);
  if (inputTokens > maxInputTokens) return { ok: false, code: 'input_token_limit_exceeded' };
  if (body.temperature !== undefined && (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 1.5)) {
    return { ok: false, code: 'temperature_invalid' };
  }
  if (body.response_format !== undefined && (!isPlainObject(body.response_format)
    || !onlyKeys(body.response_format, ['type']) || body.response_format.type !== 'json_object')) {
    return { ok: false, code: 'response_format_invalid' };
  }
  const maxTokens = body.max_tokens === undefined ? Math.min(config.maxOutputTokens, limits.outputTokens) : body.max_tokens;
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > Math.min(config.maxOutputTokens, limits.outputTokens)) {
    return { ok: false, code: 'output_token_limit_exceeded' };
  }
  return { ok: true, body: { ...body, max_tokens: maxTokens }, inputTokens };
}

export function validateAudioRequest(body, config) {
  if (!isPlainObject(body) || !onlyKeys(body, ['model', 'audio_base64', 'mime_type', 'language', 'response_format'])) {
    return { ok: false, code: 'request_schema_invalid' };
  }
  if (body.model !== 'whisper-large-v3-turbo') return { ok: false, code: 'model_not_allowed' };
  if (typeof body.audio_base64 !== 'string' || !isBase64(body.audio_base64)) {
    return { ok: false, code: 'audio_invalid' };
  }
  const decodedBytes = Math.floor((body.audio_base64.length * 3) / 4)
    - (body.audio_base64.endsWith('==') ? 2 : body.audio_base64.endsWith('=') ? 1 : 0);
  if (decodedBytes < 1 || decodedBytes > config.maxAudioBytes) return { ok: false, code: 'audio_too_large' };
  if (!['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav'].includes(body.mime_type)) {
    return { ok: false, code: 'audio_mime_invalid' };
  }
  if (body.language !== undefined && (typeof body.language !== 'string' || !/^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/.test(body.language))) {
    return { ok: false, code: 'audio_language_invalid' };
  }
  if (body.response_format !== undefined && body.response_format !== 'json') return { ok: false, code: 'audio_format_invalid' };
  return { ok: true, body, decodedBytes };
}
