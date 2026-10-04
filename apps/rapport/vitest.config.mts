import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local test harness for the Rapport domain modules that are self-contained.
//
// NOTE: the committed tree is missing several modules (skills.ts, recommender.ts,
// behaviours.ts, reflection.ts, addressing.ts, ai/prompts.ts, ai/telemetry.ts,
// human-evidence.ts) and package.json, so the app does not currently build and
// most suites cannot resolve their imports. This config exists so the modules
// that DO stand alone — starting with behaviour-state — can be tested honestly
// rather than being left unverified. It is deliberately scoped: run a specific
// suite with `node <path-to-vitest> run src/domain/tests/...`.
export default defineConfig({
  test: {
    // Only the self-contained behaviour-state suite runs from this harness.
    // Broader suites belong to the full app test run once the missing modules land.
    include: ["tests/behaviour-state.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
    },
  },
});