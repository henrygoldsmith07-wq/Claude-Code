#!/usr/bin/env node
/**
 * Workspace AI helper - OpenRouter only, allowlist-enforced.
 *
 * Every call must use a model id from config/ai/models.json; anything else
 * is refused. Credentials come from config/ai/.env (gitignored).
 * Token policy: free models (":free" suffix or "free": true in the
 * allowlist) have no token limit by default (pass --max-tokens to cap);
 * paid models default to 1024.
 *
 * CLI:
 *   node scripts/ai.mjs list                       # show allowed models
 *   node scripts/ai.mjs ask "prompt"               # default model, one-shot
 *   node scripts/ai.mjs ask --model "GLM 5.2" --max-tokens 500 "prompt"
 *
 * Library:
 *   import { ai } from "../scripts/ai.mjs";
 *   const text = await ai("Summarise this diff", { model: "Gemma 4 31B" });
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CFG = JSON.parse(readFileSync(path.join(ROOT, "config/ai/models.json"), "utf8"));

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(path.join(ROOT, CFG.envFile), "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trim().startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  } catch {
    throw new Error(`ai: missing ${CFG.envFile} — create it with OPENROUTER_API_KEY=<key> (never commit it)`);
  }
  return env;
}

function providerFor(chosen) {
  const pid = chosen.provider || "openrouter";
  const p = (CFG.providers || {})[pid];
  if (!p) throw new Error(`ai: unknown provider "${pid}" for ${chosen.slug}`);
  return p;
}

function resolve(model) {
  if (!model || model === CFG.defaultModel) {
    return CFG.models.find((m) => m.slug === CFG.defaultModel)
      ?? { slug: CFG.defaultModel, label: "default", provider: "openrouter" };
  }
  const norm = (s) => String(s).toLowerCase().replace(/\s*\(free\)\s*$/i, "").trim();
  const hit =
    CFG.models.find((m) => m.slug === model) ??
    CFG.models.find((m) => norm(m.label) === norm(model)) ??
    CFG.models.find((m) => norm(m.label) === `${norm(model)} free`);
  if (!hit) {
    throw new Error(`ai: model "${model}" is not in the allowlist (config/ai/models.json). Use: node scripts/ai.mjs list`);
  }
  return hit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(env, chosen, messages, opts) {
  // Policy: entries flagged free (":free" suffix or "free": true) are uncapped
  // unless --max-tokens is passed explicitly; paid models default to 1024 so
  // an accident can't burn real credit.
  const isFree = String(chosen.slug).endsWith(":free") || chosen.free === true;
  const prov = providerFor(chosen);
  const payload = { model: chosen.slug, messages };
  if (opts.maxTokens !== undefined) payload.max_tokens = opts.maxTokens;
  else if (!isFree) payload.max_tokens = 1024;
  if (opts.temperature !== undefined) payload.temperature = opts.temperature;
  const key = env[prov.envKey];
  if (!key) throw new Error(`missing ${prov.envKey} in ${CFG.envFile}`);
  const res = await fetch(`${prov.baseUrl}${CFG.endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error body */ }
  return { res, body };
}

async function attempt(env, cand, messages, opts) {
  // free-tier models rotate upstream rate limits constantly; retry once on 429
  let { res, body } = await callOnce(env, cand, messages, opts);
  if (res.status === 429 && opts.retries !== 0) {
    // a DAILY-quota 429 ("free-models-per-day") applies to every :free model
    // in the account — retrying or walking the chain is pointless; abort fast.
    const msg = String(body.error?.message ?? res.statusText);
    if (!/free-models-per-day/i.test(msg)) await sleep(6000);
    ({ res, body } = await callOnce(env, cand, messages, opts));
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.error?.message ?? res.statusText}`);
  }
  const msg2 = body.choices?.[0]?.message ?? {};
  // reasoning models can spend tokens in .reasoning before .content
  const out = String(msg2.content ?? "").trim() || String(msg2.reasoning ?? "").trim();
  if (body.usage && out === "") {
    throw new Error(`no content (finish_reason: ${body.choices?.[0]?.finish_reason})`);
  }
  return out;
}

/**
 * Ask the allowlist across providers. Fallback chain: the requested model
 * first, then every other ranked model from config/ai/models.json in
 * intelligence order (entries with noFallback are skipped). NVIDIA NIM models
 * lead (no daily cap); OpenRouter :free models back them up. ai() returns just
 * the text; aiDetailed() also reports which model answered.
 */
export async function aiDetailed(prompt, opts = {}) {
  const env = loadEnv();
  const chosen = resolve(opts.model ?? prompt.model);
  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: String(prompt) }];
  const chain = [
    chosen,
    ...CFG.models.filter((m) => m.slug !== chosen.slug && !m.noFallback),
  ];
  let lastErr;
  for (let i = 0; i < chain.length; i++) {
    try {
      return { text: await attempt(env, chain[i], messages, opts), model: `${chain[i].provider || "openrouter"}:${chain[i].slug}` };
    } catch (e) {
      lastErr = e;
      // account-wide daily free quota on one provider: skip that provider's
      // remaining models but keep walking other providers' lanes.
      if (/free-models-per-day/i.test(String(e.message)) && opts.onFallback) {
        const deadProvider = providerFor(chain[i]);
        // mark rest of this provider's models as failed by filtering chain in place
        for (let j = chain.length - 1; j > i; j--) {
          if (providerFor(chain[j]) === deadProvider) chain.splice(j, 1);
        }
      }
      if (i < chain.length - 1 && opts.onFallback)
        opts.onFallback(chain[i], chain[i + 1], e.message);
    }
  }
  throw new Error(`ai: all ${chain.length} models failed; last error (${chain[chain.length - 1].slug}): ${lastErr?.message}`);
}

export async function ai(prompt, opts = {}) {
  return (await aiDetailed(prompt, opts)).text;
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "list") {
    console.log(`default: ${CFG.defaultModel}\n`);
    for (const m of CFG.models) console.log(`${m.slug.padEnd(58)} ${m.label}`);
    if (CFG.unresolved.length) {
      console.log("\nunresolved (no OpenRouter chat-completions slug):");
      for (const u of CFG.unresolved) console.log(`  - ${u.label}: ${u.reason}`);
    }
  } else if (cmd === "ask") {
    const modelIdx = rest.indexOf("--model");
    const maxIdx = rest.indexOf("--max-tokens");
    const prompt = rest.filter((a, i) =>
      a.startsWith("--") || (i > 0 && (rest[i - 1] === "--model" || rest[i - 1] === "--max-tokens")) ? false : true
    ).join(" ");
    if (!prompt) {
      console.error('usage: node scripts/ai.mjs ask [--model <slug|label>] [--max-tokens N] "prompt"');
      process.exitCode = 1;
    } else {
      const t0 = Date.now();
      try {
        const { text, model } = await aiDetailed(prompt, {
          model: modelIdx > -1 ? rest[modelIdx + 1] : undefined,
          maxTokens: maxIdx > -1 ? Number(rest[maxIdx + 1]) : undefined,
          onFallback: (from, to, msg) =>
            console.error(`ai: ${from.slug} failed (${msg}) — falling back to ${to.slug}`),
        });
        console.log(text + `\n[${model} · ${(Date.now() - t0) / 1000}s]`);
      } catch (e) {
        console.error(String(e.message));
        process.exitCode = 1;
      }
    }
  } else {
    console.error("usage: node scripts/ai.mjs <list|ask> ...");
    process.exitCode = 1;
  }
}
