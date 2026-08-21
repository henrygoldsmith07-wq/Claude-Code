'use strict';
// Large real-world log corpus builder: captures diverse tool outputs into benchmark/corpus/*.log
// Deterministic synthetic variants (for CI) plus optional live capture when tools are present.
// Every fixture is labeled in manifest.json as real captured | synthetic | adversarial | generated
// Synthetic data is NEVER counted as real-world corpus evidence.

const fs=require('fs'), path=require('path'), cp=require('child_process');
function ensureDir(d){ fs.mkdirSync(d,{recursive:true}); }

function writeFileWithManifest(dir, manifest, name, content, provenance, meta={}) {
  const full=path.join(dir,name);
  fs.writeFileSync(full,content);
  manifest.push({ file:name, provenance, tool: meta.tool||'unknown', category: meta.category||'simple-failure', capturedAt: new Date().toISOString(), ...meta });
}

function synthCorpus(){
  const dir=path.join(__dirname,'corpus');
  ensureDir(dir);
  const d=require('./datasets');
  const f=require('./fixtures');
  const manifest=[];
  const entries=[
    // Basic synthetic fixtures (per-tool)
    ['vitest-fail.log', f.vitestFailFixture({lines:800,fails:2}), 'synthetic', {tool:'vitest', category:'simple-failure'}],
    ['vitest-pass.log', f.vitestPassFixture({lines:800}), 'synthetic', {tool:'vitest', category:'successful'}],
    ['tsc-fail.log', f.tscFailFixture({errors:4}), 'synthetic', {tool:'tsc', category:'simple-failure'}],
    ['tsc-pass.log', f.tscPassFixture(), 'synthetic', {tool:'tsc', category:'successful'}],
    ['next-fail.log', f.nextBuildFailFixture(), 'synthetic', {tool:'next', category:'simple-failure'}],
    ['next-pass.log', f.nextBuildPassFixture(), 'synthetic', {tool:'next', category:'successful'}],
    ['gha-fail.log', d.githubActionsLog({jobs:3, stepsPerJob:8}), 'synthetic', {tool:'gha', category:'github-actions'}],
    ['diff-4files.log', d.diffLog({files:4}), 'synthetic', {tool:'git', category:'diff'}],
    ['stack.log', d.stackLog(), 'synthetic', {tool:'generic', category:'stack-trace'}],
    ['json-search.log', d.jsonSearchResults({hits:50}), 'synthetic', {tool:'generic', category:'json'}],
    ['ndjson.log', Array.from({length:100},(_,i)=>JSON.stringify(i===50?{level:'error',msg:'boom',file:'src/app.ts:10:5'}:{level:'info',msg:`ok ${i}`})).join('\n'), 'synthetic', {tool:'generic', category:'ndjson'}],
    ['junit.xml', '<?xml version="1.0"?><testsuite name="foo"><testcase classname="a" name="t1"/><testcase classname="a" name="t2"><failure message="boom">at src/app.ts:10:5</failure></testcase></testsuite>', 'synthetic', {tool:'generic', category:'junit'}],
    ['sarif.json', JSON.stringify({version:'2.1.0', runs:[{tool:{driver:{name:'eslint'}}, results:[{level:'error', message:{text:'boom'}, locations:[{physicalLocation:{artifactLocation:{uri:'src/app.ts'}}}]}]}]}, null, 2), 'synthetic', {tool:'generic', category:'sarif'}],
    ['ansi.log', '\u001b[31mFAIL\u001b[0m src/app.test.ts > boom\n\u001b[31mAssertionError: expected 1 to equal 2\u001b[0m\n  at \u001b[33msrc/app.ts:10:5\u001b[0m', 'synthetic', {tool:'vitest', category:'ansi'}],
    ['unicode.log', 'Error: boom 💥 at src/ünicode.ts:10:5\nTests  1 failed — café naïve résumé', 'synthetic', {tool:'generic', category:'unicode'}],
    ['generic-fail.log', f.genericFailFixture(), 'synthetic', {tool:'generic', category:'simple-failure'}],
    // Real CI failure shapes (synthetic but realistic)
    ['npm-ci-fail.log', d.npmCiFailLog(), 'synthetic', {tool:'pm', category:'simple-failure'}],
    ['cargo-build-fail.log', d.cargoBuildFailLog(), 'synthetic', {tool:'cargo', category:'simple-failure'}],
    ['playwright-fail.log', d.playwrightFailLog(), 'synthetic', {tool:'generic', category:'simple-failure'}],
    ['eslint-scan.log', d.eslintScanLog(), 'synthetic', {tool:'eslint', category:'warnings'}],
    ['gha-real-fail.log', d.ghaRealFailLog(), 'synthetic', {tool:'gha', category:'github-actions'}],
    ['pytest-traceback.log', d.pytestTracebackLog(), 'synthetic', {tool:'pytest', category:'simple-failure'}],
    ['maven-fail.log', '[ERROR] COMPILATION ERROR\n[ERROR] /src/App.java:[10,5] cannot find symbol\n[ERROR] symbol: variable foo\nTests run: 1, Failures: 1, Errors: 0, Skipped: 0\n[INFO] BUILD FAILURE', 'synthetic', {tool:'maven', category:'simple-failure'}],
    ['gradle-fail.log', 'FAILURE: Build failed with an exception\n* What went wrong:\nExecution failed for task \':app:compileJava\'.\n> Compilation failed\n  e: /src/App.kt:10:5 Unresolved reference: foo\n* Try:\nBUILD FAILED in 2s', 'synthetic', {tool:'gradle', category:'simple-failure'}],
    ['docker-fail.log', 'Step 3/5 : RUN npm ci\n ---> Running in abc123\nnpm error code ERESOLVE\nERROR: failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1', 'synthetic', {tool:'docker', category:'simple-failure'}],
    ['k8s-crash.log', 'NAME READY STATUS RESTARTS AGE\nmy-pod 0/1 CrashLoopBackOff 5 2m\nEvents:\n  Type Reason Age From Message\n  Warning BackOff 5s kubelet Back-off restarting failed container\n  Warning Failed 5s kubelet Error: container failed', 'synthetic', {tool:'k8s', category:'simple-failure'}],
    ['terraform-fail.log', 'Error: Invalid value for variable\n on main.tf line 10, in resource "aws_instance" "web":\n  10: instance_type = var.instance_type\nThe given value is not suitable for aws_instance.web: must be one of t2.micro, t2.small.\n\nError: Error locking state: Error acquiring the state lock', 'synthetic', {tool:'terraform', category:'simple-failure'}],
    ['go-fail.log', '--- FAIL: TestFoo (0.00s)\n    foo_test.go:10: expected 1 got 2\n    foo_test.go:11: extra context\nFAIL\tgithub.com/foo/bar 0.012s\nFAIL', 'synthetic', {tool:'go', category:'simple-failure'}],
    ['git-conflict.log', 'Auto-merging src/app.ts\nCONFLICT (content): Merge conflict in src/app.ts\nAutomatic merge failed; fix conflicts and then commit the result.\nerror: could not apply abc123', 'synthetic', {tool:'git', category:'simple-failure'}],
    // Adversarial / pathological (labeled adversarial)
    ['massive-stack.log', Array.from({length:200},(_,i)=>`  at func${i} (src/app.ts:${10+i}:5)`).join('\n') + '\nError: boom\n' + Array.from({length:200},(_,i)=>`  at internal${i} (node:internal/process/task_queues:95:5)`).join('\n'), 'adversarial', {tool:'generic', category:'massive-stack'}],
    ['nested-failure.log', 'Error: outer failure\nCaused by: Error: inner failure at src/inner.ts:42:10\n  at inner (src/inner.ts:42:10)\nCaused by: Error: root cause at src/root.ts:10:5\n  at root (src/root.ts:10:5)\nFailed to compile: 3 errors', 'adversarial', {tool:'generic', category:'nested-failure'}],
    ['malformed-json.log', '{ "incomplete": [1,2, \n truncated', 'adversarial', {tool:'generic', category:'malformed'}],
    ['malformed-output.log', 'FAIL src/foo.test.ts > bar\nAssertionError: expected 1 to equal 2\n\x00\x01\x02 binary junk \xFF\nTests  1 failed', 'adversarial', {tool:'vitest', category:'malformed'}],
    ['duplicate-messages.log', Array.from({length:50},()=> 'Error: duplicate warning at src/app.ts:10:5 — something went wrong').join('\n') + '\nError: real failure at src/app.ts:42:10\n  at src/app.ts:42:10', 'adversarial', {tool:'generic', category:'duplicate'}],
    ['interleaved-parallel.log', Array.from({length:100},(_,i)=> i%2===0?`[worker-${i%3}] ok ${i}`:`[worker-${i%3}] Error: fail at src/worker${i%3}.ts:${10+i}:5`).join('\n'), 'adversarial', {tool:'generic', category:'interleaved-parallel'}],
    ['partial-truncated.log', 'FAIL src/app.test.ts > boom\nAssertionError: expected 1 to equal 2\n  at src/app.ts:10:5\n[truncated mid-token — missing tail]', 'adversarial', {tool:'vitest', category:'partial'}],
    ['truncated-log.log', d.cliVerboseLog({lines:5000}).slice(0, 8000) + '\n… [log truncated by CI buffer at 8k]', 'adversarial', {tool:'generic', category:'truncated'}],
    ['ansi-heavy.log', Array.from({length:100},(_,i)=> `\u001b[${31 + i%6}m${i%10===0?'FAIL src/a.test.ts > case '+i+'\nAssertionError: boom':'ok line '+i}\u001b[0m`).join('\n'), 'adversarial', {tool:'vitest', category:'ansi'}],
    ['windows-paths.log', 'src\\components\\Foo.tsx:10:5 - error TS2322: Type string not assignable\nC:\\Users\\runner\\project\\src\\app.ts:42:10 — Failed to compile\nError at C:\\project\\src\\bar.ts:100:20', 'adversarial', {tool:'tsc', category:'windows-paths'}],
    ['unix-paths.log', '/home/runner/project/src/app.ts:10:5 - error TS2322: Type string not assignable\nError at ./src/app/page.tsx:42:10', 'adversarial', {tool:'tsc', category:'unix-paths'}],
    ['invalid-utf8.log', 'Error: boom at src/app.ts:10:5\nTests 1 failed\n\xFF\xFE invalid bytes \uD800 lone surrogate', 'adversarial', {tool:'generic', category:'invalid-utf8'}],
    ['unusual-unicode.log', 'Error: boom 💥 🦄 café naïve résumé — 故障 at src/ünicode-测试.ts:10:5\nTests  1 failed — 🚨', 'adversarial', {tool:'generic', category:'unicode'}],
    ['huge-log.log', Array.from({length:8000},(_,i)=>`line ${String(i).padStart(5,'0')} ${i%100===0?'Error: boom at src/app.ts:10:5':'ok '+ 'x'.repeat(20)}`).join('\n'), 'adversarial', {tool:'generic', category:'huge'}],
  ];
  for(const [name,content,provenance,meta] of entries){
    writeFileWithManifest(dir, manifest, name, content, provenance, meta);
  }
  // Attempt real captures (labeled captured) — best effort, skips if tool missing
  try { captureRealOutputs(dir, manifest); } catch(e) { console.log('real capture skipped: '+e.message); }
  // Clean the temp capture workspace
  try { fs.rmSync(path.join(__dirname,'.tmp-capture'), { recursive: true, force: true }); } catch {}
  // Write manifest.json
  fs.writeFileSync(path.join(dir,'manifest.json'), JSON.stringify({ generatedAt:new Date().toISOString(), count: manifest.length, files: manifest }, null, 2));
  console.log(`corpus-builder: ensured ${manifest.length} entries in ${dir} (manifest.json written)`);
}

function captureRealOutputs(dir, manifest) {
  // Capture real git output
  try {
    const gitStatus = cp.execSync('git status --porcelain', { encoding:'utf8', timeout:3000 });
    writeFileWithManifest(dir, manifest, 'real-git-status.log', gitStatus || '(clean)', 'captured', {tool:'git', category:'successful', command:'git status'});
  } catch {}
  try {
    const gitLog = cp.execSync('git log --oneline -5', { encoding:'utf8', timeout:3000 });
    writeFileWithManifest(dir, manifest, 'real-git-log.log', gitLog, 'captured', {tool:'git', category:'successful', command:'git log'});
  } catch {}
  try {
    const gitDiff = cp.execSync('git diff --stat HEAD', { encoding:'utf8', timeout:3000 });
    if (gitDiff.trim()) writeFileWithManifest(dir, manifest, 'real-git-diff.log', gitDiff, 'captured', {tool:'git', category:'diff', command:'git diff'});
  } catch {}
  // Capture tsc via local typescript if available
  try {
    const tscPath = path.join(dir,'..','node_modules','.bin','tsc');
    const hasTsc = fs.existsSync(tscPath) || fs.existsSync(path.join(__dirname,'..','node_modules','typescript','bin','tsc'));
    if (hasTsc) {
      // Create a temp broken file and run tsc
      const tmpDir = path.join(__dirname,'.tmp-capture');
      ensureDir(tmpDir);
      fs.writeFileSync(path.join(tmpDir,'broken.ts'), 'const x: number = "oops";\n');
      const tscBin = fs.existsSync(tscPath) ? tscPath : path.join(__dirname,'..','node_modules','typescript','bin','tsc');
      const out = cp.execSync(`node "${tscBin}" --noEmit --skipLibCheck "${path.join(tmpDir,'broken.ts')}"`, { encoding:'utf8', timeout:5000 });
      writeFileWithManifest(dir, manifest, 'real-tsc-pass.log', out || '(no output)', 'captured', {tool:'tsc', category:'successful', command:'tsc --noEmit'});
    }
  } catch(e) {
    // tsc failure is expected — capture stderr
    try {
      const msg = String(e.stdout || e.stderr || e.message || '');
      if (msg.includes('error TS')) writeFileWithManifest(dir, manifest, 'real-tsc-fail.log', msg, 'captured', {tool:'tsc', category:'simple-failure', command:'tsc --noEmit'});
    } catch {}
  }
  // Capture npm errors etc: try running npm with invalid command in temp
  try {
    const out = cp.execSync('node "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js" --version', { encoding:'utf8', timeout:3000 });
    writeFileWithManifest(dir, manifest, 'real-npm-version.log', out, 'captured', {tool:'pm', category:'successful', command:'npm --version'});
  } catch {}
  // Try to capture pytest-like via node test if python missing: use node --test failure shape as proxy
  try {
    const nodeTestFail = cp.execSync('node -e "require(\'node:test\'); require(\'node:assert/strict\').equal(1,2)"', { encoding:'utf8', timeout:3000 });
    writeFileWithManifest(dir, manifest, 'real-node-test.log', nodeTestFail, 'captured', {tool:'generic', category:'simple-failure', command:'node --test'});
  } catch(e) {
    const msg = String(e.stdout || e.stderr || e.message || '');
    if (msg) writeFileWithManifest(dir, manifest, 'real-node-test-fail.log', msg, 'captured', {tool:'generic', category:'simple-failure', command:'node --test'});
  }
}

if(require.main===module) synthCorpus();
module.exports={synthCorpus};
