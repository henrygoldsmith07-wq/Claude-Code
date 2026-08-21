// Relay response types — server-side TypeScript canonical definitions.

export interface RelayChatRequest {
  model: string;
  messages: Array<{ role: 'system'|'user'|'assistant'; content: string | Array<{ type: 'text'|'image_url'; text?: string; image_url?: { url: string }}> }>;
  temperature?: number;
  response_format?: { type: 'json_object' };
  max_tokens?: number;
}

export interface RelayAudioRequest {
  model: 'whisper-large-v3-turbo';
  audio_base64: string;
  mime_type: 'audio/webm'|'audio/mp4'|'audio/ogg'|'audio/mpeg'|'audio/wav'|'audio/x-wav';
  language?: string;
  response_format?: 'json';
}

export interface RelayError { error: string; retryAfter?: number }
