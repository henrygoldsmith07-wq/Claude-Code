import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

function localPath(relative: string): string {
  // Vitest hands aliases to esbuild. On Windows, esbuild can interpret the
  // backslashes returned by fileURLToPath as escape sequences while loading
  // the config, which makes the config itself fail before a test starts.
  return fileURLToPath(new URL(relative, import.meta.url)).replaceAll("\\", "/");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": localPath("./src"),
      // `server-only` throws by design when imported outside a server
      // component. Tests exercise those modules directly, so it is stubbed —
      // the guarantee it enforces (no bundling into the client) is a build
      // concern, checked by `next build`, not by the test runner.
      "server-only": localPath("./tests/stubs/server-only.ts"),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});

