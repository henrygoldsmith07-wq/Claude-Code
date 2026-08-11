'use strict';

const PRESETS = {
  'claude-code': { aggressiveness: 'balanced', contextWindow: 2, truncate: { headLines: 20, tailLines: 5 } },
  codex:        { aggressiveness: 'conservative', contextWindow: 3, truncate: { headLines: 30, tailLines: 10 } },
  cursor:       { aggressiveness: 'balanced', contextWindow: 2, truncate: { headLines: 20, tailLines: 5 } },
  cline:        { aggressiveness: 'balanced', contextWindow: 2, truncate: { headLines: 20, tailLines: 5 } },
  generic:      { aggressiveness: 'balanced', contextWindow: 2, truncate: { headLines: 20, tailLines: 5 } },
};

function presetNames() { return Object.keys(PRESETS); }
function resolvePreset(explicit, env, configPreset) {
  const raw = (explicit || env || configPreset || '').toLowerCase().trim();
  if (!raw) return null;
  if (PRESETS[raw]) return { name: raw, ...PRESETS[raw] };
  return null;
}
function applyPreset(config, preset) {
  if (!preset) return config;
  const out = { ...config };
  if (preset.aggressiveness) out.aggressiveness = preset.aggressiveness;
  if (preset.truncate) out.truncate = { ...out.truncate, ...preset.truncate };
  out.contextWindow = preset.contextWindow;
  out.preset = preset.name;
  if (preset.aggressiveness === 'conservative') {
    out.truncate.headLines = Math.max(out.truncate.headLines, 30);
    out.truncate.tailLines = Math.max(out.truncate.tailLines, 10);
  } else if (preset.aggressiveness === 'aggressive') {
    out.truncate.headLines = Math.min(out.truncate.headLines, 12);
    out.truncate.tailLines = Math.min(out.truncate.tailLines, 3);
  }
  return out;
}
module.exports = { PRESETS, presetNames, resolvePreset, applyPreset };
