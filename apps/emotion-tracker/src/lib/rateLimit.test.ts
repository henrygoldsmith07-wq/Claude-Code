import { describe, it, expect } from "vitest";
import { rateLimit, getClientIp } from "./rateLimit";

describe("rateLimit", () => {
  it("allows up to limit then denies", () => {
    const key = `test-${Date.now()}-allow`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(false);
  });

  it("getClientIp prefers x-forwarded-for", () => {
    const req = {
      headers: {
        get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null),
      },
    } as unknown as Request;
    expect(getClientIp(req)).toBe("1.2.3.4");
  });
});
