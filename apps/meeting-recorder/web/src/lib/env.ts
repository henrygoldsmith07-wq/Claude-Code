/**
 * Centralised environment access. Throwing here (lazily, at call time) gives
 * clear errors when a required integration isn't configured, instead of opaque
 * failures deep inside the SDKs.
 */
export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". See apps/meeting-recorder/web/.env.example`
    );
  }
  return value;
}

export function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}
