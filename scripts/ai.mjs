#!/usr/bin/env node
/**
 * Workspace AI helper - OpenRouter only, allowlist-enforced.
 *
 * Every call must use a model id from config/ai/models.json; anything else
 * is refused. Credentials come from config/ai/.env (gitignored).
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

function resolve(model) {
  if (!model || model === CFG.defaultModel) return { slug: CFG.defaultModel, label: "default" };
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
  const res = await fetch(`${env.OPENROUTER_BASE_URL}${CFG.endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: chosen.slug,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export async function ai(prompt, opts = {}) {
  const env = loadEnv();
  const chosen = resolve(opts.model ?? prompt.model);
  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: "user", content: String(prompt) }];

  // free-tier models rotate upstream rate limits constantly; retry once on 429
  let { res, body } = await callOnce(env, chosen, messages, opts);
  if (res.status === 429 && opts.retries !== 0) {
    await sleep(6000);
    ({ res, body } = await callOnce(env, chosen, messages, opts));
  }
  if (!res.ok) {
    throw new Error(`ai: HTTP ${res.status} ${chosen.slug}: ${body.error?.message ?? res.statusText}`);
  }
  const msg = body.choices?.[0]?.message ?? {};
  // reasoning models can spend tokens in .reasoning before .content
  const out = String(msg.content ?? "").trim() || String(msg.reasoning ?? "").trim();
  if (body.usage && out === "") {
    throw new Error(`ai: ${chosen.slug} returned no content (finish_reason: ${body.choices?.[0]?.finish_reason}); try a higher --max-tokens`);
  }
  return out;
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
        const out = await ai(prompt, {
          model: modelIdx > -1 ? rest[modelIdx + 1] : undefined,
          maxTokens: maxIdx > -1 ? Number(rest[maxIdx + 1]) : undefined,
        });
        console.log(out + `\n[${Date.now() - t0}ms]`);
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
