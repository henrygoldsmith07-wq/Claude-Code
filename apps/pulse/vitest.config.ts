import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    // Two projects rather than one: the analytics engine is framework-free and
    // runs in plain Node, and only the UI tests pay for a DOM.
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "engine",
          globals: true,
          environment: "node",
          include: ["tests/**/*.test.ts"],
          testTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "ui",
          globals: true,
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
