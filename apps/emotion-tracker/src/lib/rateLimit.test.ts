import { describe, it, expect } from "vitest";
import { rateLimit, getClientIp } from "./rateLimit";

describe("rateLimit", () => {
  it("allows up to limit then denies", () => {
    const key = `test-${Date.now()}-allow`;
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(true);
    expect(rateLimit(key, 2, 60_000).ok).toBe(false);
  });

  it("getClientIp honours x-forwarded-for only behind a trusted proxy", () => {
    const req = {
      headers: {
        get: (k: string) => (k === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null),
      },
    } as unknown as Request;

    // Without TRUST_PROXY the client-controlled header is ignored (spoof-proof)
    delete process.env.TRUST_PROXY;
    expect(getClientIp(req)).toBe("unknown");

    // Behind a trusted proxy it names the real client
    process.env.TRUST_PROXY = "1";
    try {
      expect(getClientIp(req)).toBe("1.2.3.4");
    } finally {
      delete process.env.TRUST_PROXY;
    }
  });
});
