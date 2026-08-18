/**
 * Persistent preview server for the browser e2e suite.
 *
 * `npx playwright test` starts its own server and tears it down at the end of
 * every run, paying for a full build each time. Run this once in a terminal
 * and the suite reuses it (`webServer.reuseExistingServer`), so repeated runs
 * start in seconds instead of after a build.
 *
 * Idempotent: if something already answers 127.0.0.1:4173 it prints and
 * exits, leaving that server untouched. Restart this after changing app code
 * so the rebuilt bundle is what gets served.
 */
import { spawn } from "node:child_process";
import process from "node:process";

const HEALTH_URL = "http://127.0.0.1:4173";

// On Windows the package manager is npm.cmd; spawning it directly (no shell)
// avoids Node's DEP0190 warning and keeps signal handling clean.
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(NPM, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function isServing() {
  try {
    const response = await fetch(HEALTH_URL);
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (await isServing()) {
    console.log(`[e2e-server] ${HEALTH_URL} is already serving — reusing it.`);
    process.exit(0);
  }

  console.log("[e2e-server] building the app…");
  await run(["run", "build"]);

  console.log(`[e2e-server] serving ${HEALTH_URL} — Ctrl+C to stop.`);
  const preview = spawn(NPM, ["run", "preview"], { stdio: "inherit" });
  preview.on("exit", (code) => process.exit(code ?? 1));

  // The preview child keeps this process alive; forward shutdown signals so a
  // Ctrl+C in this terminal takes the server down with it.
  process.on("SIGINT", () => preview.kill("SIGINT"));
  process.on("SIGTERM", () => preview.kill("SIGTERM"));
}

main().catch((error) => {
  console.error(`[e2e-server] ${error.message}`);
  process.exit(1);
});
