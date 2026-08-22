'use strict';

/**
 * Public benchmark dashboard.
 *
 * Aggregates whichever benchmark/*.json artifacts exist (results, families,
 * detection, levels, paired, evidence, retention, retention-fields) into:
 *   - dashboard.json  machine-readable snapshot
 *   - dashboard.html  self-contained page (inline CSS, embedded JSON, zero
 *                     external requests)
 *
 * Missing artifacts are skipped gracefully and reported in `sources`.
 *
 * Usage:
 *   node benchmark/dashboard.js              # print artifact paths
 *   node benchmark/dashboard.js --write      # write both artifacts
 *   node benchmark/dashboard.js --write --out <dir>
 */

const fs = require('fs');
const path = require('path');
const { getRtkCommit, getBenchmarkVersion, getCorpusVersion } = require('../src/provenance');

const EQUIV = (() => { try { return require('../src/equivalence'); } catch { return {}; } })();

const SOURCES = ['results', 'families', 'detection', 'levels', 'paired', 'evidence', 'retention', 'retention-fields'];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function round4(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10000) / 10000 : null;
}

function readSourceDoc(dir, name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  } catch { return null; }
}

function safeGetter(fn, fallback) {
  try { const v = fn(); return v == null ? fallback : String(v); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// section builders — each returns null when the source doc is absent/malformed
// ---------------------------------------------------------------------------

function buildReduction(doc) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  let rawTotal = 0;
  let emittedTotal = 0;
  let counted = false;
  const rows = doc.rows.map((r) => {
    const rawTokens = num(r && r.rawTokens);
    const emittedTokens = num(r && r.emittedTokens);
    if (rawTokens != null && emittedTokens != null) { rawTotal += rawTokens; emittedTotal += emittedTokens; counted = true; }
    return {
      label: r && r.label != null ? String(r.label) : '',
      parser: r && r.parser != null ? String(r.parser) : '',
      rawTokens,
      emittedTokens,
      tokenReductionPct: num(r && r.tokenReductionPct),
      tokensSaved: num(r && r.tokensSaved),
      criticalRetained: !!(r && r.criticalRetained),
    };
  });
  return {
    tokenizer: doc.tokenizer != null ? String(doc.tokenizer) : null,
    generatedAt: doc.generatedAt || null,
    cases: rows.length,
    totals: {
      rawTokens: counted ? rawTotal : null,
      emittedTokens: counted ? emittedTotal : null,
      overallReductionPct: counted && rawTotal > 0 ? Math.round((1 - emittedTotal / rawTotal) * 100) : null,
    },
    rows,
  };
}

function buildFamilies(doc) {
  if (!doc || !Array.isArray(doc.families)) return null;
  return {
    cases: num(doc.cases),
    families: doc.families.map((f) => ({
      id: f && f.id != null ? String(f.id) : '',
      label: f && f.label != null ? String(f.label) : '',
      encoding: f && f.encoding != null ? String(f.encoding) : '',
      model: f && f.model != null ? String(f.model) : '',
      reductionPct: num(f && f.reductionPct),
      tokensSaved: num(f && f.tokensSaved),
      costSaved: num(f && f.costSaved),
      price: f && f.price != null ? String(f.price) : null,
    })),
    stability: doc.stability || null,
  };
}

function buildDetection(doc) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  const rows = doc.rows.map((r) => ({
    label: r && r.label != null ? String(r.label) : '',
    expectedName: r && r.expectedName != null ? String(r.expectedName) : '',
    gotName: r && r.gotName != null ? String(r.gotName) : '',
    ok: !!(r && r.ok),
  }));
  const okCount = rows.filter((r) => r.ok).length;
  return {
    total: rows.length,
    okCount,
    ratePct: rows.length ? Math.round((okCount / rows.length) * 1000) / 10 : null,
    failures: rows.filter((r) => !r.ok),
  };
}

function buildLevels(doc) {
  const lv = doc && doc.levels;
  if (!lv || typeof lv !== 'object' || Array.isArray(lv)) return null;
  return {
    count: num(doc.count),
    seed: num(doc.seed),
    levels: Object.keys(lv).sort().map((k) => {
      const entry = lv[k] || {};
      const stats = entry.stats || {};
      const eq = entry.equivalence || {};
      return {
        level: k,
        total: num(stats.total),
        rawSuccessRate: round4(num(stats.rawSuccessRate)),
        rtkSuccessRate: round4(num(stats.rtkSuccessRate)),
        avgReduction: num(stats.avgReduction),
        equivalent: !!eq.equivalent,
      };
    }),
  };
}

function buildPaired(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const stats = doc.stats || {};
  const equivalence = doc.equivalence || {};
  const economics = doc.economics || {};

  const total = num(stats.total);
  const rawS = num(stats.rawSuccesses);
  const rtkS = num(stats.rtkSuccesses);
  let wilson = null;
  if (typeof EQUIV.wilsonInterval === 'function' && total != null && total > 0
      && rawS != null && rtkS != null) {
    const raw = EQUIV.wilsonInterval(rawS, total);
    const rtk = EQUIV.wilsonInterval(rtkS, total);
    wilson = {
      alpha: 0.05,
      raw: { point: round4(raw.point), lower: round4(raw.lower), upper: round4(raw.upper) },
      rtk: { point: round4(rtk.point), lower: round4(rtk.lower), upper: round4(rtk.upper) },
    };
  }

  return {
    count: num(doc.count) != null ? num(doc.count) : total,
    level: doc.level != null ? String(doc.level) : null,
    seed: num(doc.seed),
    stats: {
      total,
      rawSuccesses: rawS,
      rtkSuccesses: rtkS,
      rawSuccessRate: round4(num(stats.rawSuccessRate)),
      rtkSuccessRate: round4(num(stats.rtkSuccessRate)),
      pairedDifference: round4(num(stats.pairedDifference)),
      discordant: num(stats.discordant),
      confidenceInterval: stats.confidenceInterval || null,
      margin: round4(num(stats.margin)),
      equivalent: !!stats.equivalent,
      avgRawTokens: num(stats.avgRawTokens),
      avgRtkTokens: num(stats.avgRtkTokens),
      avgReduction: num(stats.avgReduction),
    },
    equivalence: equivalence && typeof equivalence === 'object' ? {
      n: num(equivalence.n), a: num(equivalence.a), b: num(equivalence.b),
      c: num(equivalence.c), d: num(equivalence.d),
      difference: round4(num(equivalence.difference)),
      lower: round4(num(equivalence.lower)), upper: round4(num(equivalence.upper)),
      equivalent: !!equivalence.equivalent, margin: round4(num(equivalence.margin)),
      note: equivalence.note != null ? String(equivalence.note) : null,
    } : null,
    economics: economics && typeof economics === 'object' ? {
      net: num(economics.net),
      netPct: round4(num(economics.netPct)),
      extraRetries: num(economics.extraRetries),
      profitable: !!economics.profitable,
      note: economics.note != null ? String(economics.note) : null,
    } : null,
    wilson,
  };
}

function buildEvidence(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const paired = doc.paired && typeof doc.paired === 'object' ? doc.paired : {};
  return {
    corpusInventory: doc.corpusInventory || null,
    pairedCount: num(paired.count),
  };
}

function buildRetention(doc) {
  if (!doc || !Array.isArray(doc.rows)) return null;
  const rows = doc.rows;
  return {
    cases: rows.length,
    criticalRetained: rows.filter((r) => r && r.criticalRetained).length,
    missed: rows.filter((r) => !(r && r.criticalRetained)).map((r) => (r.label != null ? String(r.label) : '')),
  };
}

function buildRetentionFields(doc) {
  const agg = doc && doc.agg;
  if (!agg || typeof agg !== 'object' || Array.isArray(agg)) return null;
  return {
    fields: Object.keys(agg)
      .map((k) => ({
        field: k,
        label: agg[k] && agg[k].label != null ? String(agg[k].label) : k,
        retentionPct: num(agg[k] && agg[k].retentionPct),
        casesPerfectRate: num(agg[k] && agg[k].casesPerfectRate),
        casesApplicable: num(agg[k] && agg[k].casesApplicable),
      }))
      .sort((a, b) => (b.retentionPct || 0) - (a.retentionPct || 0)),
  };
}

function collectFailureStats(failuresDir) {
  const byCategory = {};
  let count = 0;
  try {
    for (const f of fs.readdirSync(failuresDir)) {
      if (!f.endsWith('.json')) continue;
      let rec = null;
      try { rec = JSON.parse(fs.readFileSync(path.join(failuresDir, f), 'utf8')); } catch { rec = null; }
      if (!rec) continue;
      count += 1;
      const cat = (rec.classification || rec.failureCategory || 'unknown').toString();
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
  } catch { /* dir missing — registry empty */ }
  return { count, byCategory };
}

function computeProvenance(docs, override) {
  if (override && typeof override === 'object') {
    return {
      rtkCommit: override.rtkCommit != null ? String(override.rtkCommit) : 'unknown',
      benchmarkVersion: override.benchmarkVersion != null ? String(override.benchmarkVersion) : 'unknown',
      corpusVersion: override.corpusVersion != null ? String(override.corpusVersion) : 'unknown',
    };
  }
  const embedded = (docs.paired && docs.paired.provenance) || (docs.evidence && docs.evidence.provenance) || {};
  return {
    rtkCommit: embedded.rtkCommit != null ? String(embedded.rtkCommit)
      : safeGetter(getRtkCommit, 'unknown'),
    benchmarkVersion: embedded.benchmarkVersion != null ? String(embedded.benchmarkVersion)
      : safeGetter(getBenchmarkVersion, 'unknown'),
    corpusVersion: embedded.corpusVersion != null ? String(embedded.corpusVersion)
      : safeGetter(getCorpusVersion, 'unknown'),
  };
}

// ---------------------------------------------------------------------------
// aggregation
// ---------------------------------------------------------------------------

function buildDashboardData(opts = {}) {
  const dir = opts.dir || __dirname;
  const readJson = opts.readJson || ((name) => readSourceDoc(dir, name));

  const docs = {};
  const sources = {};
  for (const name of SOURCES) {
    const doc = readJson(name);
    docs[name] = doc;
    sources[name] = doc && typeof doc === 'object' ? 'ok' : 'missing';
  }

  const reduction = buildReduction(docs.results);
  const families = buildFamilies(docs.families);
  const detection = buildDetection(docs.detection);
  const levels = buildLevels(docs.levels);
  const paired = buildPaired(docs.paired);
  const evidence = buildEvidence(docs.evidence);
  const retention = buildRetention(docs.retention);
  const retentionFields = buildRetentionFields(docs['retention-fields']);
  const failureCorpus = opts.failureCorpus || collectFailureStats(path.join(dir, 'failures'));

  const headlineTokenizer = (reduction && reduction.tokenizer)
    || ((families && families.families.find((f) => f.encoding) || {}).encoding)
    || 'unknown';

  return {
    generatedAt: opts.now ? new Date(opts.now).toISOString() : new Date().toISOString(),
    provenance: computeProvenance(docs, opts.provenance),
    headline: {
      overallReductionPct: reduction ? reduction.totals.overallReductionPct : null,
      tokenizer: headlineTokenizer,
      cases: reduction ? reduction.cases : null,
      detectionRatePct: detection ? detection.ratePct : null,
      pairedEquivalent: paired ? paired.stats.equivalent || (paired.equivalence && paired.equivalence.equivalent) : null,
      pairedCount: paired ? paired.count : null,
      failureCount: failureCorpus.count,
    },
    reduction,
    families,
    detection,
    levels,
    paired,
    evidence,
    retention,
    retentionFields,
    failureCorpus,
    sources,
  };
}

// ---------------------------------------------------------------------------
// HTML rendering — pure string templating, deterministic given `data`
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function embedJson(data) {
  // Escape every '<' so a </script> sequence inside the payload can never
  // terminate the tag early; JSON.parse reads \u003c back as '<'.
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function fmtInt(v) {
  return v == null ? '&mdash;' : Number(v).toLocaleString('en-US');
}

function fmtPct(v) {
  return v == null ? '&mdash;' : `${Number(v).toLocaleString('en-US')}%`;
}

function fmtRate(p) {
  return p == null ? '&mdash;' : `${(Number(p) * 100).toFixed(1)}%`;
}

function fmtCi(w) {
  if (!w || w.lower == null || w.upper == null) return '&mdash;';
  return `${(Number(w.lower) * 100).toFixed(1)}% &ndash; ${(Number(w.upper) * 100).toFixed(1)}%`;
}

const CSS = `
:root{color-scheme:dark light;--bg:#0b0f14;--panel:#131a22;--fg:#dbe4ee;--muted:#8aa0b4;--accent:#4cc38a;--warn:#e3b341;--bad:#f85149;--line:#22303d}
@media (prefers-color-scheme:light){:root{--bg:#f6f8fa;--panel:#ffffff;--fg:#1f2428;--muted:#57606a;--line:#d0d7de}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:24px 20px 64px}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:17px;margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--muted);font-size:13px;margin:0 0 22px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.card .l{color:var(--muted);font-size:11.5px;text-transform:uppercase;letter-spacing:.05em}
.card .v{font-size:25px;font-weight:650;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--panel);border:1px solid var(--line)}
th,td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em}
tr:last-child td{border-bottom:none}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.ok{color:var(--accent)}.bad{color:var(--bad)}.warn{color:var(--warn)}.muted{color:var(--muted)}
.badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;background:var(--panel);border:1px solid var(--line);margin:2px 4px 2px 0}
.missing{color:var(--muted);font-style:italic}
.note{background:var(--panel);border:1px solid var(--line);padding:12px 14px;color:var(--muted);font-size:13px}
code{background:var(--panel);padding:1px 5px;border-radius:4px;font-size:12.5px}
footer{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
footer code{word-break:break-all}
`;

function missingNote(name) {
  return `<p class="missing">(source missing: ${escapeHtml(name)}.json &mdash; run its generator to populate this section)</p>`;
}

function renderHtml(data) {
  const d = data || {};
  const h = d.headline || {};
  const prov = d.provenance || {};
  const src = d.sources || {};
  const out = [];

  out.push('<!DOCTYPE html>');
  out.push('<html lang="en">');
  out.push('<head>');
  out.push('<meta charset="utf-8">');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  out.push(`<title>RTK benchmark dashboard${prov.rtkCommit && prov.rtkCommit !== 'unknown' ? ' @ ' + escapeHtml(prov.rtkCommit.slice(0, 7)) : ''}</title>`);
  out.push(`<style>${CSS}</style>`);
  out.push('</head>');
  out.push('<body><div class="wrap">');

  out.push('<header>');
  out.push('<h1>RTK benchmark dashboard</h1>');
  out.push(`<p class="sub">Token savings and safety of RTK output filtering &mdash; generated ${escapeHtml(d.generatedAt || '')}</p>`);
  out.push('</header>');

  // headline numbers
  out.push('<section id="headline"><div class="cards">');
  out.push(`<div class="card"><div class="l">Overall token reduction</div><div class="v ${h.overallReductionPct == null ? 'muted' : 'ok'}">${fmtPct(h.overallReductionPct)}</div></div>`);
  out.push(`<div class="card"><div class="l">Tokenizer</div><div class="v">${escapeHtml(h.tokenizer || 'unknown')}</div></div>`);
  out.push(`<div class="card"><div class="l">Benchmark cases</div><div class="v">${fmtInt(h.cases)}</div></div>`);
  out.push(`<div class="card"><div class="l">Parser detection</div><div class="v">${fmtPct(h.detectionRatePct)}</div></div>`);
  out.push(`<div class="card"><div class="l">Paired eval (${fmtInt(h.pairedCount)} tasks)</div><div class="v ${h.pairedEquivalent ? 'ok' : h.pairedEquivalent === false ? 'warn' : 'muted'}">${h.pairedEquivalent == null ? '&mdash;' : h.pairedEquivalent ? '&#10003; equivalent' : 'not established'}</div></div>`);
  out.push(`<div class="card"><div class="l">Known failures captured</div><div class="v ${h.failureCount ? 'warn' : 'ok'}">${fmtInt(h.failureCount)}</div></div>`);
  out.push('</div></section>');

  // reduction table
  out.push('<h2 id="reduction">Per-case token reduction</h2>');
  if (d.reduction && Array.isArray(d.reduction.rows)) {
    const t = d.reduction.totals || {};
    out.push(`<p class="sub">${fmtInt(d.reduction.cases)} cases &middot; ${fmtInt(t.rawTokens)} &rarr; ${fmtInt(t.emittedTokens)} tokens overall (${fmtPct(t.overallReductionPct)} saved)</p>`);
    out.push('<table><thead><tr><th>Case</th><th>Parser</th><th class="n">Raw tok</th><th class="n">Emitted tok</th><th class="n">Saved</th><th>Needles kept</th></tr></thead><tbody>');
    for (const r of d.reduction.rows) {
      out.push(`<tr><td>${escapeHtml(r.label)}</td><td class="muted">${escapeHtml(r.parser)}</td><td class="n">${fmtInt(r.rawTokens)}</td><td class="n">${fmtInt(r.emittedTokens)}</td><td class="n ${r.criticalRetained ? 'ok' : 'bad'}">${fmtPct(r.tokenReductionPct)}</td><td>${r.criticalRetained ? '<span class="ok">&#10003;</span>' : '<span class="bad">&times;</span>'}</td></tr>`);
    }
    out.push('</tbody></table>');
  } else out.push(missingNote('results'));

  // family coverage
  out.push('<h2 id="families">Tokenizer family coverage</h2>');
  if (d.families && Array.isArray(d.families.families)) {
    const st = d.families.stability;
    out.push(st ? `<p class="sub">Spread across encodings: ${fmtPct(st.minPct)}&ndash;${fmtPct(st.maxPct)} (avg ${fmtPct(st.avgPct)}) over ${fmtInt(d.families.cases)} cases</p>` : '');
    out.push('<table><thead><tr><th>Family</th><th>Encoding</th><th>Model</th><th class="n">Reduction</th><th class="n">Tokens saved</th><th>Price basis</th></tr></thead><tbody>');
    for (const f of d.families.families) {
      out.push(`<tr><td>${escapeHtml(f.label)}</td><td class="muted">${escapeHtml(f.encoding)}</td><td class="muted">${escapeHtml(f.model)}</td><td class="n ok">${fmtPct(f.reductionPct)}</td><td class="n">${fmtInt(f.tokensSaved)}</td><td class="muted">${escapeHtml(f.price || '')}</td></tr>`);
    }
    out.push('</tbody></table>');
  } else out.push(missingNote('families'));

  // detection rates
  out.push('<h2 id="detection">Parser detection accuracy</h2>');
  if (d.detection) {
    const det = d.detection;
    out.push(`<p class="sub">${fmtInt(det.okCount)}/${fmtInt(det.total)} labeled commands detected correctly (${fmtPct(det.ratePct)})</p>`);
    if (det.failures.length) {
      out.push('<table><thead><tr><th>Case</th><th>Expected</th><th>Got</th></tr></thead><tbody>');
      for (const f of det.failures) {
        out.push(`<tr><td>${escapeHtml(f.label)}</td><td class="ok">${escapeHtml(f.expectedName)}</td><td class="bad">${escapeHtml(f.gotName)}</td></tr>`);
      }
      out.push('</tbody></table>');
    } else {
      out.push('<p class="note">No mis-detections in the current labeled set.</p>');
    }
  } else out.push(missingNote('detection'));

  // paired evaluation with CI ranges
  out.push('<h2 id="paired">Paired evaluation (raw vs RTK)</h2>');
  if (d.paired) {
    const p = d.paired;
    const s = p.stats || {};
    const eq = p.equivalence;
    out.push(`<p class="sub">${fmtInt(p.count)} tasks, level ${escapeHtml(p.level || 'default')}${p.seed != null ? `, seed ${fmtInt(p.seed)}` : ''} &mdash; both arms attempt every task; only discordant pairs carry signal.</p>`);
    out.push('<table><thead><tr><th>Arm</th><th class="n">Tasks</th><th class="n">Success rate</th><th>Wilson 95% CI</th></tr></thead><tbody>');
    out.push(`<tr><td>Raw tool output</td><td class="n">${fmtInt(s.total)}</td><td class="n">${fmtRate(s.rawSuccessRate)}</td><td>${fmtCi(p.wilson && p.wilson.raw)}</td></tr>`);
    out.push(`<tr><td>RTK-filtered output</td><td class="n">${fmtInt(s.total)}</td><td class="n">${fmtRate(s.rtkSuccessRate)}</td><td>${fmtCi(p.wilson && p.wilson.rtk)}</td></tr>`);
    out.push('</tbody></table>');
    if (eq) {
      const verdict = eq.equivalent
        ? '<span class="badge ok">equivalent &#10003;</span>'
        : '<span class="badge warn">equivalence not established</span>';
      out.push(`<p>${verdict} Difference ${(eq.difference * 100).toFixed(1)}pp (90% CI ${fmtCi({ lower: eq.lower, upper: eq.upper })}) within &plusmn;${((eq.margin || 0) * 100).toFixed(0)}pp margin.${eq.note ? ` <span class="muted">${escapeHtml(eq.note)}</span>` : ''}</p>`);
    }
    if (p.economics && p.economics.net != null) {
      out.push(`<p class="note">Net economics: ${fmtInt(p.economics.net)} tokens saved per run (${p.economics.profitable ? '<span class="ok">profitable</span>' : '<span class="bad">unprofitable</span>'}), ${fmtInt(p.economics.extraRetries)} extra retries attributed to filtering.${p.economics.note ? ` ${escapeHtml(p.economics.note)}` : ''}</p>`);
    }
  } else out.push(missingNote('paired'));

  // levels sweep
  if (d.levels && Array.isArray(d.levels.levels)) {
    out.push('<h2 id="levels">Filtering levels sweep</h2>');
    out.push('<table><thead><tr><th>Level</th><th class="n">Tasks</th><th class="n">RTK success</th><th class="n">Avg reduction</th><th>Equivalent</th></tr></thead><tbody>');
    for (const l of d.levels.levels) {
      out.push(`<tr><td>${escapeHtml(l.level)}</td><td class="n">${fmtInt(l.total)}</td><td class="n">${fmtRate(l.rtkSuccessRate)}</td><td class="n">${fmtPct(l.avgReduction)}</td><td>${l.equivalent ? '<span class="ok">&#10003;</span>' : '<span class="warn">?</span>'}</td></tr>`);
    }
    out.push('</tbody></table>');
  }

  // failure corpus
  out.push('<h2 id="corpus">Failure corpus</h2>');
  const fc = d.failureCorpus || { count: 0, byCategory: {} };
  const cats = Object.entries(fc.byCategory || {}).sort((a, b) => b[1] - a[1]);
  out.push(`<p><strong>${fmtInt(fc.count)}</strong> confirmed failure(s) captured where the raw tool succeeded but RTK did not.`);
  out.push(cats.length ? ` Categories: ${cats.map(([c, n]) => `<span class="badge">${escapeHtml(c)} &times; ${fmtInt(n)}</span>`).join(' ')}</p>` : '</p>');
  out.push('<p class="note">Public sanitized export: <code>public/failure-corpus.json</code> and <code>public/failure-corpus.md</code> (secrets redacted, local paths stripped via <code>benchmark/export-failure-corpus.js</code>).</p>');

  // provenance footer
  out.push('<footer id="provenance">');
  out.push(`<p>rtk commit <code>${escapeHtml((prov.rtkCommit || '').slice(0, 7) || 'unknown')}</code> (<code>${escapeHtml(prov.rtkCommit || 'unknown')}</code>) &middot; benchmark version <code>${escapeHtml(prov.benchmarkVersion || 'unknown')}</code> &middot; corpus version <code>${escapeHtml(prov.corpusVersion || 'unknown')}</code></p>`);
  out.push(`<p>Generated ${escapeHtml(d.generatedAt || '')} &middot; sources: ${Object.keys(src).map((k) => `<span class="badge ${src[k] === 'ok' ? 'ok' : 'muted'}">${escapeHtml(k)}: ${escapeHtml(src[k])}</span>`).join('')}</p>`);
  out.push('</footer>');

  out.push('</div>');
  out.push('<script type="application/json" id="dashboard-data">' + embedJson(data) + '</script>');
  out.push('</body></html>');
  return out.join('\n') + '\n';
}

module.exports = { SOURCES, buildDashboardData, renderHtml, escapeHtml };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const flags = { write: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') flags.write = true;
    else if (a === '--out') { i += 1; flags.out = argv[i] || null; }
    else if (a.startsWith('--out=')) flags.out = a.slice('--out='.length) || null;
    else if (a === '--open' || a.startsWith('--open=')) { /* never auto-open */ }
    else throw new Error(`unknown flag: ${a}`);
  }
  return flags;
}

if (require.main === module) {
  const flags = parseFlags(process.argv.slice(2));
  const data = buildDashboardData();
  const html = renderHtml(data);
  const jsonOut = JSON.stringify(data, null, 2) + '\n';
  const outDir = path.resolve(flags.out || __dirname);
  const jsonPath = path.join(outDir, 'dashboard.json');
  const htmlPath = path.join(outDir, 'dashboard.html');
  if (!flags.write) {
    console.log(jsonPath);
    console.log(htmlPath);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(jsonPath, jsonOut);
    fs.writeFileSync(htmlPath, html);
    console.log(`[dashboard] wrote ${jsonPath} (${Buffer.byteLength(jsonOut)} bytes)`);
    console.log(`[dashboard] wrote ${htmlPath} (${Buffer.byteLength(html)} bytes)`);
  }
}
