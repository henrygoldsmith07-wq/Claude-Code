import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws by design when imported outside a server
      // component. Tests exercise those modules directly, so it is stubbed —
      // the guarantee it enforces (no bundling into the client) is a build
      // concern, checked by `next build`, not by the test runner.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
