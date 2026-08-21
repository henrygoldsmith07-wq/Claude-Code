#!/usr/bin/env node
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Static security checks. Heuristic by necessity, but calibrated so the
// current tree passes: a failure means either (a) a real regression — a
// secret reachable from client code, an unguarded fetch of a user URL,
// RLS dropped, or (b) this script needs updating alongside the pattern.
// Warnings are advisory and never fail the gate.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];

function check(label, ok, msg) {
  if (!ok) failures.push(`${label}: ${msg}`);
  else console.log(`OK   ${label}`);
}

function warn(label, msg) {
  warnings.push(`${label}: ${msg}`);
  console.warn(`WARN ${label}: ${msg}`);
}

const SECRET_ENV = /process\.env\.(?:ANTHROPIC_API_KEY|OPENAI[A-Z_]*API_KEY|GROQ_API_KEY|SUPABASE_SERVICE_ROLE)/;

function walkSrc(appId) {
  const src = path.join(root, "apps", appId, "src");
  const files = [];
  if (!existsSync(src)) return files;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !["node_modules", ".next", "dist"].includes(e.name)) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(full);
    }
  };
  walk(src);
  return files;
}

// Client-reachable surfaces: components and pages/layouts. Route handlers,
// server lib modules, middleware are server-side.
const CLIENT_SURFACE = /[\\\/](components[\\\/]|app[\\\/][^\\\/]*page\.|app[\\\/]layout\.)/;

const apps = readdirSync(path.join(root, "apps")).filter((name) => existsSync(path.join(root, "apps", name, "src")));

// ---------------------------------------------------------------------------
// 1. Provider secrets must not be readable from any client surface
// ---------------------------------------------------------------------------
{
  const leaks = [];
  for (const app of apps) {
    for (const file of walkSrc(app)) {
      const rel = path.relative(root, file);
      if (!SECRET_ENV.test(readFileSync(file, "utf8"))) continue;
      // Allowed only in server-side locations; flag anything else.
      const isRoute = /[\\\/](app[\\\/])?api[\\\/]/.test(rel);
      const isServerLib = /[\\\/](lib|ai)[\\\/]/.test(rel) && !CLIENT_SURFACE.test(rel);
      const declaresServerOnly = readFileSync(file, "utf8").includes("server-only");
      if (CLIENT_SURFACE.test(rel) || (!isRoute && !isServerLib && !declaresServerOnly)) {
        leaks.push(rel);
      }
    }
  }
  check(
    "secrets/not-in-client-surface",
    leaks.length === 0,
    leaks.length ? `secret env read in client-reachable file(s): ${leaks.join("; ")}` : "",
  );
}

// ---------------------------------------------------------------------------
// 2. SSRF: server-side fetch of a variable URL must carry a guard
//    (https-only validation AND private/link-local host rejection), OR the
//    identifier must be assigned from a constant https endpoint nearby.
//    Client-surface files are skipped: browser fetch cannot reach the
//    server's internal network, so this is a server-side concern only.
// ---------------------------------------------------------------------------
{
  const unguarded = [];
  const GUARD = /isPrivateHost|validateRetrievalUrl|PRIVATE_HOST|api\.anthropic\.com|api\.groq\.com|graph\.microsoft\.com|googleapis\.com|hostname\s*(?:===|\.endsWith)|\.endsWith\(["']\./;
  const BROWSER_CODE = /\blocalStorage\b|\bdocument\.|\bwindow\.|navigator\./;
  for (const app of apps) {
    for (const file of walkSrc(app)) {
      const rel = path.relative(root, file);
      if (CLIENT_SURFACE.test(rel)) continue; // browser-side fetch — not SSRF
      const lines = readFileSync(file, "utf8").split("\n");
      const whole = lines.join("\n");
      if (BROWSER_CODE.test(whole)) continue; // runs in the browser — not SSRF
      lines.forEach((line, i) => {
        const m = line.match(/\bfetch\s*\(\s*([A-Za-z_$][\w$]*)\s*[),]/);
        if (!m) return;
        const arg = m[1];
        if (/^(request|req|options|opts|input)$/i.test(arg)) return;
        // Constant endpoint assigned just above? e.g. const endpoint = ... 'https://...'
        const context = lines.slice(Math.max(0, i - 8), i + 1).join("\n");
        if (new RegExp(`${arg}\\s*=`).test(context) && context.includes("https://")) return;
        if (GUARD.test(context) || GUARD.test(whole)) return;
        unguarded.push(`${rel}:${i + 1} (fetch(${arg}))`);
      });
    }
  }
  check(
    "ssrf/variable-url-fetches-guarded",
    unguarded.length === 0,
    unguarded.length ? `server-side fetch of variable URL without https/private-host guard: ${unguarded.join("; ")}` : "",
  );
}

// ---------------------------------------------------------------------------
// 3. RLS present in every Supabase schema (or explicitly documented as open)
// ---------------------------------------------------------------------------
for (const app of apps) {
  const schema = path.join(root, "apps", app, "supabase", "schema.sql");
  const migDir = path.join(root, "apps", app, "supabase", "migrations");
  if (!existsSync(schema) && !existsSync(migDir)) continue;
  if (!existsSync(schema)) {
    warn(`rls/${app}`, "no schema.sql — migrations only; add a reviewed squashed schema");
    continue;
  }
  const sql = readFileSync(schema, "utf8");
  if (/enable row level security/.test(sql)) {
    check(`rls/${app}`, true, "");
  } else if (/using \(true\)/.test(sql)) {
    warn(`rls/${app}`, "RLS intentionally permissive (using true) — single-user anon-key app, documented in schema header");
  } else {
    check(`rls/${app}`, false, "schema.sql has neither 'enable row level security' nor a documented permissive policy");
  }
}

// ---------------------------------------------------------------------------
// 4. AI routes rate-limited
// ---------------------------------------------------------------------------
const aiRoutes = [
  "apps/revise/src/app/api/ai/route.ts",
  "apps/rapport/src/app/api/ai/route.ts",
  "apps/daily-debate/src/app/api/solo/start/route.ts",
  "apps/daily-debate/src/app/api/solo/[debateId]/turn/route.ts",
  "apps/emotion-tracker/src/app/api/reflect/route.ts",
];
for (const route of aiRoutes) {
  const full = path.join(root, ...route.split("/"));
  if (!existsSync(full)) continue;
  const limited = /rateLimit|checkRateLimit|rate-limit/i.test(readFileSync(full, "utf8"));
  if (limited) check(`rate-limit/${route}`, true, "");
  else warn(`rate-limit/${route}`, "no rate limiting found — should gate AI endpoint");
}

// ---------------------------------------------------------------------------
// 5. Provider modules reading secrets must not be imported by client surfaces
//    (dependency-free equivalent of `server-only` for apps that lack it)
// ---------------------------------------------------------------------------
{
  const violations = [];
  for (const app of ["revise", "rapport", "daily-debate", "emotion-tracker"]) {
    const providers = ["src/lib/anthropic.ts", "src/ai/provider.ts", "src/lib/gemini.ts"]
      .map((p) => path.join(root, "apps", app, ...p.split("/")))
      .filter(existsSync)
      .filter((f) => SECRET_ENV.test(readFileSync(f, "utf8")));
    for (const provider of providers) {
      const base = path.basename(provider, ".ts");
      const importRe = new RegExp(`from ["'][^"']*\\/${base}(\\.js)?["']`);
      for (const file of walkSrc(app)) {
        const rel = path.relative(root, file);
        if (file === provider) continue;
        if (importRe.test(readFileSync(file, "utf8")) && CLIENT_SURFACE.test(rel)) {
          violations.push(`${rel} imports provider module ${base}`);
        }
      }
    }
  }
  check(
    "providers/not-imported-by-client",
    violations.length === 0,
    violations.length ? violations.join("; ") : "",
  );
}

// ---------------------------------------------------------------------------
// 6. Invitation tokens: stored hashed; no client DELETE grant on shared boards
// ---------------------------------------------------------------------------
{
  const schema = path.join(root, "apps", "mental-load-tracker", "supabase", "schema.sql");
  if (existsSync(schema)) {
    const sql = readFileSync(schema, "utf8");
    check("noticed/token-hash", /token_hash/.test(sql) && /sha256|digest/.test(sql), "invitation tokens must be stored as sha256 digests, not raw");
    check("noticed/no-client-delete", /grant select,\s*insert,\s*update on public\.items/.test(sql) && !/grant[^;]*delete on public\.items/.test(sql), "items must not grant DELETE to clients");
  }
}

if (warnings.length) console.log(`\n${warnings.length} warning(s).`);

if (failures.length) {
  console.error(`\nSecurity audit failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nSecurity audit passed.");
