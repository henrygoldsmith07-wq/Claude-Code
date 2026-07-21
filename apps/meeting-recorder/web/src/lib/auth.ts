import { NextRequest } from "next/server";
import { optional } from "./env";

/**
 * The desktop recorder authenticates uploads with a shared secret in the
 * `x-api-key` header. If DESKTOP_API_KEY is unset we allow requests (useful for
 * local dev), but log a warning-worthy condition to the caller.
 */
export function isAuthorized(req: NextRequest): boolean {
  const expected = optional("DESKTOP_API_KEY");
  if (!expected) return true; // open in local dev when unset
  return req.headers.get("x-api-key") === expected;
}
