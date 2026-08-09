import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the pure-ish constants/helpers by importing TOPICS and exercising fetchScopeGeoNews with a mocked fetch.
import { GDELT_TOPICS } from "./gdelt";
import { TOPICS } from "./gemini";

describe("GDELT topic config", () => {
  it("covers all canonical topics", () => {
    for (const t of TOPICS) expect(GDELT_TOPICS).toContain(t);
  });
});

describe("fetchScopeGeoNews (mocked)", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          ok: true,
          json: async () => ({
            features: [
              {
                geometry: { coordinates: [-74, 40.7] },
                properties: { name: "New York", html: '<a href="https://example.com/a">Headline A</a>' },
              },
            ],
          }),
        }) as unknown as Response,
      ),
    );
  });

  afterEach(() => {
    global.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("returns points from mocked GDELT", async () => {
    const { fetchScopeGeoNews } = await import("./gdelt");
    const { points } = await fetchScopeGeoNews("Testland", 2);
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].lat).toBeGreaterThan(-90);
  });
});
