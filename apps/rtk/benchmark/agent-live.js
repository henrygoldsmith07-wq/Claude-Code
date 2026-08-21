'use strict';

/**
 * Live LLM agent benchmark: raw vs RTK task success across GPT / Claude / Gemini.
 * Uses provider-agnostic registry (src/providers.js) with frontier/medium/small tiers.
 * When no keys present, falls back to precondition (needle retention) so CI stays green.
 * Supports: --tier=frontier|medium|small, --providers=..., --models=..., --corpus=N
 *
 * Usage:
 *   node benchmark/agent-live.js --write
 *   node benchmark/agent-live.js --tier=frontier --corpus 20
 *   node benchmark/agent-live.js --providers openai --corpus 20 --models gpt-4o,gpt-4o-mini
 *   node benchmark/agent-live.js --tier=medium
 */

const fs = require('fs');
const path = require('path');
const { collectProvenance } = require('../src/provenance');

function hasAnyKeys() {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

function buildPrompt(output, needles) {
  return `You are a coding assistant. Given this tool output, list the fix-critical needles.
Output:
\`\`\`
${output.slice(0, 8000)}
\`\`\`
Needles to find (exact substrings): ${needles.join(' | ')}
Reply with one line per needle: the needle text if present, else "MISSING: <needle>". No other text.`;
}

function scoreLiveResponse(text, needles) {
  const lower = String(text).toLowerCase();
  let found = 0;
  for (const n of needles) {
    if (lower.includes(String(n).toLowerCase()) && !lower.includes(`missing: ${String(n).toLowerCase()}`)) found++;
    else if (String(text).includes(String(n))) found++;
  }
  return found;
}

async function runLive({ providers = null, models = null, tier = null, corpus = 5 } = {}) {
  const { buildCases } = require('./agent-solve');
  const cases = buildCases().slice(0, corpus);
  let modelList;
  try {
    const { listModels } = require('../src/providers');
    modelList = listModels({ provider: providers, tier, model: models });
    if (!modelList.length) {
      // fallback to all if filter empty
      modelList = listModels({});
    }
  } catch {
    // fallback simple list if providers module missing
    modelList = [
      { id: 'mock', provider: 'mock', tier: 'small', label: 'Mock' },
    ];
    if (!hasAnyKeys()) modelList = [{ id: 'mock', provider:'mock', tier:'small', label:'Mock'}];
    else {
      if (process.env.OPENAI_API_KEY) modelList.push({ id:'gpt-4o-mini', provider:'openai', tier:'medium', label:'GPT-4o-mini'});
      if (process.env.ANTHROPIC_API_KEY) modelList.push({ id:'claude-3.5-sonnet', provider:'anthropic', tier:'frontier', label:'Claude'});
      if (process.env.GEMINI_API_KEY) modelList.push({ id:'gemini-1.5-flash', provider:'gemini', tier:'medium', label:'Gemini'});
    }
  }
  // If no keys, collapse to mock only so we get precondition
  if (!hasAnyKeys()) modelList = modelList.filter(m=>m.provider==='mock');
  if (!modelList.length) modelList = [{ id:'mock', provider:'mock', tier:'small', label:'Mock (precondition)' }];

  const { callModel } = (()=>{ try{ return require('../src/providers'); } catch { return { callModel: async()=>({skipped:true, reason:'no provider'}) }; }})();
  const results = [];
  for (const c of cases) {
    const { emitted } = c.parser.filter(c.output, c.exitCode);
    const variants = [
      { kind: 'raw', text: c.output },
      { kind: 'rtk', text: emitted },
    ];
    for (const v of variants) {
      const prompt = buildPrompt(v.text, c.fixNeedles);
      const providerResults = {};
      for (const model of modelList) {
        if (model.provider === 'mock') {
          providerResults[model.id] = { skipped:true, reason:'mock — precondition only', provider:'mock', model: model.id };
          continue;
        }
        const res = await callModel(model.id, prompt);
        providerResults[model.id] = res;
        // Score
        if (!res.skipped) {
          const found = scoreLiveResponse(res.text, c.fixNeedles);
          res.needlesFound = found;
          res.needlesTotal = c.fixNeedles.length;
          res.success = found >= c.fixNeedles.length;
        }
      }
      let success = false;
      const anyCalled = Object.values(providerResults).some(r => !r.skipped);
      if (anyCalled) {
        success = Object.values(providerResults).some(r=>r.success);
      } else {
        const has = c.fixNeedles.every(n => v.text.includes(n));
        success = has;
        providerResults.precondition = { success: has, reason: 'no live keys — precondition only', provider:'mock', model:'mock' };
      }
      // Record tier info per result for analysis of capability vs safety
      const tiers = [...new Set(modelList.map(m=>m.tier))].join(',');
      results.push({ label: c.label, kind: v.kind, parser: c.parser.name, needles: c.fixNeedles, success, providerResults, tier: tiers });
    }
  }
  return results;
}

function renderMarkdown(results, meta) {
  const lines = [];
  lines.push('# RTK live agent benchmark — raw vs RTK task success');
  lines.push('');
  lines.push(`Generated: ${meta.prov.executionDate}`);
  lines.push(`RTK commit: ${meta.prov.rtkCommit}`);
  lines.push(`Corpus version: ${meta.prov.corpusVersion}`);
  lines.push(`Tokenizer: ${meta.tokenizer}`);
  lines.push(`Providers: ${meta.providers || meta.models || meta.tier || 'all'}`);
  lines.push(`Tier: ${meta.tier || 'all'}`);
  lines.push(`Live keys present: ${meta.hasKeys ? 'yes' : 'no (precondition only)'}`);
  lines.push('');
  if (!meta.hasKeys) {
    lines.push('> No live API keys detected (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY). Results below are precondition needle-retention checks (same as `benchmark/agent-solve.js`), not live model calls. Add keys and re-run to get true task-success numbers.');
    lines.push('');
  } else {
    lines.push('> Each case sends the same prompt to each model with raw vs RTK output; success = model listed all fixNeedles. Latency and usage are from the provider response. Multi-tier comparison shows whether compression safety differs by model capability.');
    lines.push('');
  }
  lines.push('| Case | Kind | Model/Provider | Tier | Success | Latency | Needles |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    if (r.providerResults.precondition) {
      lines.push(`| ${r.label} | ${r.kind} | precondition | — | ${r.success ? '✓' : '✗'} | — | ${r.success ? '✓' : '✗'} |`);
    } else {
      for (const [modelId, pr] of Object.entries(r.providerResults)) {
        if (pr.skipped) continue;
        const success = pr.success ? '✓' : '✗';
        const latency = pr.latencyMs != null ? `${pr.latencyMs.toFixed(0)}ms` : '—';
        const needles = pr.needlesFound != null ? `${pr.needlesFound}/${pr.needlesTotal}` : (pr.success ? '✓' : '—');
        const tier = (()=>{ try{ const {getModel}=require('../src/providers'); const m=getModel(modelId); return m?m.tier:'—'; } catch{ return '—'; }})();
        lines.push(`| ${r.label} | ${r.kind} | ${modelId} | ${tier} | ${success} | ${latency} | ${needles} |`);
      }
    }
  }
  lines.push('');
  const rawSuccess = results.filter(r => r.kind === 'raw' && r.success).length;
  const rtkSuccess = results.filter(r => r.kind === 'rtk' && r.success).length;
  const totalKinds = results.filter(r => r.kind === 'raw').length;
  lines.push(`> Summary: raw ${rawSuccess}/${totalKinds} fixable, RTK ${rtkSuccess}/${totalKinds} fixable. RTK must not lose success vs raw.`);
  // Per-tier summary if multiple tiers present
  const tiersPresent = [...new Set(results.map(r=>r.tier).filter(Boolean))];
  if (tiersPresent.length>0) {
    lines.push('');
    lines.push('> Tier analysis: run with --tier=frontier vs --tier=small to compare compression safety by model capability. Small models are more sensitive to context removal — their discordant rate is the early warning.');
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const providersArg = args.find(a => a.startsWith('--providers='))?.split('=')[1] || args.find(a => a.startsWith('--provider='))?.split('=')[1] || null;
  const modelsArg = args.find(a => a.startsWith('--models='))?.split('=')[1] || args.find(a => a.startsWith('--model='))?.split('=')[1] || null;
  const tierArg = args.find(a => a.startsWith('--tier='))?.split('=')[1] || null;
  const corpusArg = args.find(a => a.startsWith('--corpus='))?.split('=')[1] || null;
  const corpus = corpusArg ? Math.max(1, Math.min(50, parseInt(corpusArg, 10) || 5)) : 5;
  let enc = 'chars/4';
  try { enc = require('../src/tokens').encodingName(); } catch {}
  const hasKeys = hasAnyKeys();
  const prov = collectProvenance({ benchmarkName:'agent-live', model: modelsArg||providersArg||tierArg||'mock', modelSettings: { providers: providersArg, tier: tierArg, models: modelsArg, corpus } });
  const results = await runLive({ providers: providersArg, models: modelsArg, tier: tierArg, corpus });
  const meta = { tokenizer: enc, providers: providersArg, models: modelsArg, tier: tierArg, hasKeys, prov };
  const md = renderMarkdown(results, meta);
  console.log(md);
  if (write) {
    const outMd = path.join(__dirname, 'agent-live.md');
    const outJson = path.join(__dirname, 'agent-live.json');
    fs.writeFileSync(outMd, md);
    fs.writeFileSync(outJson, JSON.stringify({ generatedAt: prov.executionDate, provenance: prov, meta: { providers: providersArg, models: modelsArg, tier: tierArg, hasKeys, tokenizer: enc }, results }, null, 2));
    console.log(`[rtk agent-live] wrote ${outMd} and ${outJson}`);
  }
  const rawWins = new Set(results.filter(r => r.kind === 'raw' && r.success).map(r => r.label));
  const rtkWins = new Set(results.filter(r => r.kind === 'rtk' && r.success).map(r => r.label));
  const lost = [...rawWins].filter(l => !rtkWins.has(l));
  if (lost.length) {
    console.error(`[rtk agent-live] FAIL — RTK lost fixability for: ${lost.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[rtk agent-live] PASS — RTK retained all fixable cases (${rawWins.size} raw, ${rtkWins.size} rtk) provider(s): ${providersArg||modelsArg||tierArg||'precondition'}`);
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });

module.exports = { runLive, hasAnyKeys };
