import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Relative, like Arise and French Practice, so the build works at the site
  // root and under a path prefix without being rebuilt for either. Pulse holds
  // its view state in memory rather than the URL, so there are no deep links to
  // resolve against a base. See apps/ecosystem-shell/README.md.
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { outDir: "dist", sourcemap: false },
});
