import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service worker and manifest are served straight from /public; no
  // build-time PWA plugin is needed and none is wanted — a hand-written
  // worker is easier to reason about than a generated one.
  // Perf budget: route budgets are enforced in tests/perf.test.ts; headers are static-cache hints.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
