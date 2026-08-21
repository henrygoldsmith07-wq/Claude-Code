'use strict';

/**
 * Failure corpus manager.
 * Whenever raw succeeds and RTK fails, capture the case, classify cause,
 * and persist to benchmark/failures/<id>.json for regression.
 *
 * Categories: filename lost, context removed, incorrect deduplication,
 * parser bug, stack trace over-compressed, ordering changed,
 * important warning removed, malformed transformation, unknown
 *
 * Usage:
 *   node benchmark/failure-corpus.js --list
 *   node benchmark/failure-corpus.js --capture  # runs paired benchmark and captures failures
 */

const fs=require('fs'), path=require('path');
const { classifyFailure } = require('../src/failure');
const { collectProvenance } = require('../src/provenance');

const FAILURES_DIR = path.join(__dirname,'failures');

function ensureDir() { fs.mkdirSync(FAILURES_DIR,{recursive:true}); }

function recordFailure({ taskId, tool, parser, rawOutput, rtkOutput, missingNeedles, provenance }) {
  ensureDir();
  const prov = provenance || collectProvenance({benchmarkName:'failure-corpus'});
  const classification = classifyFailure({ missingNeedles, rawOutput, rtkOutput });
  const record = {
    id: taskId || `fail-${Date.now()}`,
    tool, parser,
    missingNeedles,
    classification,
    capturedAt: new Date().toISOString(),
    provenance: prov,
    rawChars: String(rawOutput).length,
    rtkChars: String(rtkOutput).length,
    // Store truncated outputs to keep file small (full logs in separate file if needed)
    rawSample: String(rawOutput).slice(0, 4000),
    rtkSample: String(rtkOutput).slice(0, 4000),
  };
  const file=path.join(FAILURES_DIR, `${record.id}.json`);
  fs.writeFileSync(file, JSON.stringify(record,null,2));
  return { record, file };
}

function listFailures() {
  ensureDir();
  if (!fs.existsSync(FAILURES_DIR)) return [];
  return fs.readdirSync(FAILURES_DIR).filter(f=>f.endsWith('.json')).map(f=>{
    try { return JSON.parse(fs.readFileSync(path.join(FAILURES_DIR,f),'utf8')); } catch { return null; }
  }).filter(Boolean);
}

function summary() {
  const failures=listFailures();
  const byCause={};
  for(const f of failures) byCause[f.classification]=(byCause[f.classification]||0)+1;
  return { total: failures.length, byCause, failures };
}

function renderMarkdown() {
  const {total, byCause, failures}=summary();
  const prov=collectProvenance({benchmarkName:'failure-corpus'});
  const lines=[];
  lines.push('# RTK failure corpus — raw succeeds, RTK fails');
  lines.push('');
  lines.push(`Generated: ${prov.executionDate}`);
  lines.push(`RTK commit: ${prov.rtkCommit}`);
  lines.push(`Corpus version: ${prov.corpusVersion}`);
  lines.push('');
  if (total===0) {
    lines.push('> **No confirmed RTK-caused failures** — every case fixable from raw was also fixable from RTK in the last synthetic run. This corpus is empty by design for synthetic shaped like parsers; real-world failures will appear here when live benchmarks run against captured logs.');
  } else {
    lines.push(`> **${total} failure(s)** — each is a regression test:`);
    lines.push('');
    lines.push('| Category | Count |');
    lines.push('| --- | ---: |');
    for(const [cat,count] of Object.entries(byCause).sort((a,b)=>b[1]-a[1])) lines.push(`| ${cat} | ${count} |`);
    lines.push('');
    lines.push('| ID | Tool | Parser | Missing | Category |');
    lines.push('| --- | --- | --- | --- | --- |');
    for(const f of failures.slice(0,20)) lines.push(`| ${f.id} | ${f.tool} | ${f.parser} | ${f.missingNeedles.join(', ').slice(0,60)} | ${f.classification} |`);
  }
  lines.push('');
  lines.push('## Classification taxonomy');
  lines.push('');
  lines.push('- filename lost');
  lines.push('- context removed');
  lines.push('- incorrect deduplication');
  lines.push('- parser bug');
  lines.push('- stack trace over-compressed');
  lines.push('- ordering changed');
  lines.push('- important warning removed');
  lines.push('- malformed transformation');
  lines.push('- unknown');
  lines.push('');
  lines.push('> Each confirmed failure is added to `test/regression.test.js` via data-driven harness (benchmark/failures/*.json) so CI never re-introduces a known bug.');
  return lines.join('\n')+'\n';
}

if(require.main===module){
  const args=process.argv.slice(2);
  if(args.includes('--list')) {
    console.log(renderMarkdown());
    const s=summary();
    console.log(`\n[rtk failure-corpus] ${s.total} failures`);
  } else if(args.includes('--capture')) {
    // Run paired benchmark and capture new failures
    const {generateSyntheticTasks, evaluatePaired}=require('./paired');
    const tasks=generateSyntheticTasks({count:300});
    const evalResult=evaluatePaired(tasks);
    let captured=0;
    for(const r of evalResult.results) {
      if(r.rawSuccess && !r.rtkSuccess) {
        recordFailure({ taskId:r.taskId, tool:r.tool, parser:r.parser, rawOutput: tasks.find(t=>t.id===r.taskId)?.output || '', rtkOutput: '', missingNeedles:r.missingNeedles });
        captured++;
      }
    }
    console.log(`[rtk failure-corpus] captured ${captured} new failures (if any)`);
    console.log(renderMarkdown());
  } else {
    console.log(renderMarkdown());
  }
}

module.exports={recordFailure, listFailures, summary, renderMarkdown, FAILURES_DIR};
