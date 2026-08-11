'use strict';
const { PARSERS } = require('../src/parsers');
const f = require('./fixtures');
const d = require('./datasets');

function bench(fn, iters=1000) {
  const times=[];
  for(let i=0;i<iters;i++){ const t=performance.now(); fn(); times.push(performance.now()-t); }
  times.sort((a,b)=>a-b);
  const p50=times[Math.floor(times.length*0.5)];
  const p95=times[Math.floor(times.length*0.95)];
  const avg=times.reduce((a,b)=>a+b,0)/times.length;
  return {p50,p95,avg, iters};
}
function memBench(fn) {
  if (global.gc) global.gc();
  const before=process.memoryUsage().heapUsed;
  fn();
  const after=process.memoryUsage().heapUsed;
  return { heapDelta: after-before };
}
function run(){
  const cases=[
    {label:'vitest fail 1k', output: f.vitestFailFixture({lines:1200,fails:2}), parser:'vitest', exitCode:1},
    {label:'tsc fail 4', output: f.tscFailFixture({errors:4}), parser:'tsc', exitCode:1},
    {label:'generic 2k lines', output: d.cliVerboseLog({lines:2000}), parser:'generic', exitCode:0},
    {label:'diff 4 files', output: d.diffLog({files:4}), parser:'generic', exitCode:1},
    {label:'json 120 hits', output: d.jsonSearchResults({hits:120}), parser:'generic', exitCode:0},
  ];
  console.log('# RTK perf — latency (p50/p95/avg ms) + memory heap delta');
  console.log('');
  console.log('| Case | p50 | p95 | avg | iters | heapΔ |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
  for(const c of cases){
    const parser=PARSERS[c.parser];
    const {p50,p95,avg,iters}=bench(()=>parser.filter(c.output,c.exitCode), 200);
    const {heapDelta}=memBench(()=>parser.filter(c.output,c.exitCode));
    console.log(`| ${c.label} | ${p50.toFixed(2)}ms | ${p95.toFixed(2)}ms | ${avg.toFixed(2)}ms | ${iters} | ${(heapDelta/1024).toFixed(1)}KB |`);
  }
  // Very large output
  const huge = Array.from({length:50000},(_,i)=>`line ${i} ${i%100===0?'Error: boom':'ok'}`).join('\n');
  const t0=performance.now();
  const res=PARSERS.generic.filter(huge,1);
  const t1=performance.now();
  console.log(`\nVery large (50k lines) generic filter: ${(t1-t0).toFixed(1)}ms, emitted ${res.emitted.split('\n').length} lines, raw ${huge.length} chars`);
  // Streaming
  try {
    const { Transform } = require('stream');
    console.log('\nStreaming: use `cat log | rtk err --stdin --json` (chunked stdin, 64k buffers, binary-safe).');
  } catch {}
  // Startup
  const start = performance.now();
  require('../src/tokens');
  console.log(`Tokens module require: ${(performance.now()-start).toFixed(1)}ms (lazy, o200k_base)`);
}
if(require.main===module) run();
module.exports={run};
