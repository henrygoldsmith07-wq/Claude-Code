/**
 * Deterministic, dependency-free content hashing.
 *
 * Used for event ids and dedupe keys. Two independent FNV-1a 64 passes are
 * concatenated to give 128 bits, which is ample for de-duplicating one
 * person's lifetime of events. NOT a cryptographic hash — never use it for
 * anything that needs collision resistance against an adversary.
 */

const FNV_PRIME = 1099511628211n;
const MASK64 = (1n << 64n) - 1n;

function fnv1a(input: string, basis: bigint): bigint {
  let hash = basis;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    // Hash the UTF-16 code unit byte-wise so surrogate pairs stay distinct.
    hash = ((hash ^ BigInt(code & 0xff)) * FNV_PRIME) & MASK64;
    hash = ((hash ^ BigInt(code >>> 8)) * FNV_PRIME) & MASK64;
  }
  return hash;
}

export function hash128(input: string): string {
  const a = fnv1a(input, 14695981039346656037n);
  const b = fnv1a(input, 0xcbf29ce484222325n ^ 0x9e3779b97f4a7c15n);
  return a.toString(16).padStart(16, "0") + b.toString(16).padStart(16, "0");
}

/**
 * Stable hash of an arbitrary JSON-ish value: object keys are sorted so that
 * two structurally equal records always produce the same digest.
 */
export function stableHash(value: unknown): string {
  return hash128(stableStringify(value));
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return "null";
}
