'use strict';

/**
 * Model registry — no hard-coded single provider.
 * Frontier / medium / small tiers map to multiple actual models across providers.
 * Benchmark architecture is provider-agnostic: add a new provider by adding an
 * entry, no core logic changes. Whether compression safety differs by capability
 * is measured by running the SAME paired tasks through each tier and comparing
 * TOST intervals.
 */

const MODEL_REGISTRY = [
  // Frontier
  { id: 'gpt-4o', provider: 'openai', tier: 'frontier', contextWindow: 128_000, costKey: 'gpt-4o', label: 'GPT-4o (frontier)' },
  { id: 'claude-3.5-sonnet', provider: 'anthropic', tier: 'frontier', contextWindow: 200_000, costKey: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (frontier)' },
  { id: 'gemini-1.5-pro', provider: 'gemini', tier: 'frontier', contextWindow: 1_000_000, costKey: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (frontier)' },
  // Medium
  { id: 'gpt-4o-mini', provider: 'openai', tier: 'medium', contextWindow: 128_000, costKey: 'gpt-4o-mini', label: 'GPT-4o-mini (medium)' },
  { id: 'claude-3-haiku', provider: 'anthropic', tier: 'medium', contextWindow: 200_000, costKey: 'claude-3-haiku', label: 'Claude 3 Haiku (medium)' },
  { id: 'gemini-1.5-flash', provider: 'gemini', tier: 'medium', contextWindow: 1_000_000, costKey: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (medium)' },
  // Small / cheap
  { id: 'gpt-3.5-turbo', provider: 'openai', tier: 'small', contextWindow: 16_000, costKey: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (small)' },
  { id: 'claude-3-haiku-small', provider: 'anthropic', tier: 'small', contextWindow: 200_000, costKey: 'claude-3-haiku', label: 'Claude Haiku (small proxy)' },
  { id: 'gemini-flash-lite', provider: 'gemini', tier: 'small', contextWindow: 1_000_000, costKey: 'gemini-1.5-flash', label: 'Gemini Flash Lite (small)' },
  // Mock for CI without keys
  { id: 'mock', provider: 'mock', tier: 'small', contextWindow: 8000, costKey: 'generic', label: 'Mock (precondition only)' },
];

const TIER_ORDER = { frontier: 0, medium: 1, small: 2 };

function listModels(opts = {}) {
  let models = MODEL_REGISTRY.slice();
  if (opts.tier) models = models.filter(m => m.tier === opts.tier);
  if (opts.provider) {
    const provs = String(opts.provider).split(',').map(s=>s.trim().toLowerCase());
    models = models.filter(m => provs.includes(m.provider));
  }
  if (opts.model) {
    const ids = String(opts.model).split(',').map(s=>s.trim());
    models = models.filter(m => ids.includes(m.id));
  }
  return models;
}

function getModel(id) { return MODEL_REGISTRY.find(m=>m.id===id) || null; }

function providersAvailable() {
  const avail=[];
  if (process.env.OPENAI_API_KEY) avail.push('openai');
  if (process.env.ANTHROPIC_API_KEY) avail.push('anthropic');
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) avail.push('gemini');
  if (!avail.length) avail.push('mock');
  return avail;
}

// Generic call — dispatches to provider SDK if installed, else mock (deterministic needle check)
async function callModel(modelId, prompt, opts={}) {
  const model = getModel(modelId) || { id: modelId, provider: 'mock', tier: 'small' };
  if (model.provider === 'openai') return callOpenAI(model, prompt, opts);
  if (model.provider === 'anthropic') return callAnthropic(model, prompt, opts);
  if (model.provider === 'gemini') return callGemini(model, prompt, opts);
  // mock: return empty, caller will fall back to precondition
  return { skipped: true, reason: 'mock/no-live', provider: 'mock', model: modelId };
}

async function callOpenAI(model, prompt, opts) {
  if (!process.env.OPENAI_API_KEY) return { skipped:true, reason:'no OPENAI_API_KEY', provider:'openai', model:model.id };
  let OpenAI;
  try { OpenAI = require('openai'); } catch { return { skipped:true, reason:'openai package not installed', provider:'openai', model:model.id }; }
  try {
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const t0=performance.now();
    const res=await client.chat.completions.create({ model: model.id, messages:[{role:'user',content:prompt}], max_tokens: opts.maxTokens||300, temperature:0 });
    return { text: res.choices[0]?.message?.content||'', latencyMs: performance.now()-t0, usage: res.usage||{}, model: res.model||model.id, skipped:false, provider:'openai' };
  } catch(e){ return { skipped:true, reason:String(e.message||e), provider:'openai', model:model.id }; }
}

async function callAnthropic(model, prompt, opts) {
  if (!process.env.ANTHROPIC_API_KEY) return { skipped:true, reason:'no ANTHROPIC_API_KEY', provider:'anthropic', model:model.id };
  let Anthropic;
  try { Anthropic=require('@anthropic-ai/sdk'); } catch { return { skipped:true, reason:'@anthropic-ai/sdk not installed', provider:'anthropic', model:model.id }; }
  try {
    const Client=Anthropic.default||Anthropic.Anthropic||Anthropic;
    const client=new Client({apiKey:process.env.ANTHROPIC_API_KEY});
    const t0=performance.now();
    const res=await client.messages.create({ model: model.id, max_tokens: opts.maxTokens||300, messages:[{role:'user',content:prompt}] });
    const text=(res.content||[]).map(c=>c.text||'').join('');
    return { text, latencyMs: performance.now()-t0, usage: res.usage||{}, model: res.model||model.id, skipped:false, provider:'anthropic' };
  } catch(e){ return { skipped:true, reason:String(e.message||e), provider:'anthropic', model:model.id }; }
}

async function callGemini(model, prompt, opts) {
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return { skipped:true, reason:'no GEMINI_API_KEY', provider:'gemini', model:model.id };
  let GoogleGenerativeAI;
  try{ ({GoogleGenerativeAI}=require('@google/generative-ai')); } catch{ return { skipped:true, reason:'@google/generative-ai not installed', provider:'gemini', model:model.id }; }
  try{
    const genAI=new GoogleGenerativeAI(key);
    const m=genAI.getGenerativeModel({model:model.id});
    const t0=performance.now();
    const result=await m.generateContent(prompt);
    return { text: result.response?.text()||'', latencyMs: performance.now()-t0, usage: result.response?.usageMetadata||{}, model:model.id, skipped:false, provider:'gemini' };
  }catch(e){ return { skipped:true, reason:String(e.message||e), provider:'gemini', model:model.id }; }
}

module.exports={ MODEL_REGISTRY, listModels, getModel, providersAvailable, callModel, TIER_ORDER };
