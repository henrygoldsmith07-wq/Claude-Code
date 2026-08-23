import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set by the one-origin shell (apps/ecosystem-shell) to serve this app under
  // a path prefix. Unset means "serve at the root", which is exactly how this
  // app deploys on its own today, so leaving the variable alone changes nothing.
  basePath: process.env.APP_BASE_PATH || "",
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
