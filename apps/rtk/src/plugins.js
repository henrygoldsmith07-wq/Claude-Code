'use strict';

const fs = require('fs');
const path = require('path');

// Plugin/parser API: user-defined preservation rules + custom parsers
// A plugin file exports { name, detect(argv)->bool, filter(output, exitCode, opts)->{emitted}, rules? }

function loadPlugins(cwd, config) {
  const plugins = [];
  const pluginPaths = (config && config.plugins) || [];
  for (const p of pluginPaths) {
    const resolved = path.isAbsolute(p) ? p : path.resolve(cwd, p);
    try {
      const mod = require(resolved);
      if (mod && typeof mod.filter === 'function' && typeof mod.name === 'string') plugins.push(mod);
    } catch (_) { /* ignore broken plugin */ }
  }
  // Auto-load .rtk/plugins/**/*.js only with explicit consent: requiring
  // arbitrary JS from a cloned repo would run attacker code on every
  // `rtk err` inside it. Config-listed plugins are already explicit user
  // choices and load without the env flag.
  const autoDir = path.join(cwd, '.rtk', 'plugins');
  try {
    if (process.env.RTK_ALLOW_PLUGINS === '1' && fs.existsSync(autoDir)) {
      for (const f of fs.readdirSync(autoDir)) {
        if (!f.endsWith('.js')) continue;
        const full = path.join(autoDir, f);
        try {
          const mod = require(full);
          if (mod && typeof mod.filter === 'function' && typeof mod.name === 'string' && !plugins.some(p=>p.name===mod.name)) plugins.push(mod);
        } catch (_) {}
      }
    }
  } catch {}
  return plugins;
}

function loadPreservationRules(cwd, config) {
  const rules = [];
  const fromConfig = (config && config.preservation) || [];
  for (const r of fromConfig) {
    try {
      const re = new RegExp(r.pattern, r.flags || 'i');
      rules.push({ re, keep: r.keep !== false, reason: r.reason || `user: /${r.pattern}/` });
    } catch {}
  }
  return rules;
}

module.exports = { loadPlugins, loadPreservationRules };
