'use strict';
// Large real-world log corpus builder: captures diverse tool outputs into benchmark/corpus/*.log
// Deterministic synthetic variants (for CI) plus optional live capture when tools are present.
const fs=require('fs'), path=require('path'), cp=require('child_process');
function ensureDir(d){ fs.mkdirSync(d,{recursive:true}); }
function synthCorpus(){
  const dir=path.join(__dirname,'corpus');
  ensureDir(dir);
  const {githubActionsLog, verboseTestLog, jsonSearchResults, cliVerboseLog, diffLog, stackLog}=require('./datasets');
  const f=require('./fixtures');
  const entries=[
    ['vitest-fail.log', f.vitestFailFixture({lines:800,fails:2})],
    ['vitest-pass.log', f.vitestPassFixture({lines:800})],
    ['tsc-fail.log', f.tscFailFixture({errors:4})],
    ['next-fail.log', f.nextBuildFailFixture()],
    ['gha-fail.log', githubActionsLog({jobs:3, stepsPerJob:8})],
    ['diff-4files.log', diffLog({files:4})],
    ['stack.log', stackLog()],
    ['json-search.log', jsonSearchResults({hits:50})],
    ['ndjson.log', Array.from({length:100},(_,i)=>JSON.stringify(i===50?{level:'error',msg:'boom',file:'src/app.ts:10:5'}:{level:'info',msg:`ok ${i}`})).join('\n')],
    ['junit.xml', '<?xml version="1.0"?><testsuite name="foo"><testcase classname="a" name="t1"/><testcase classname="a" name="t2"><failure message="boom">at src/app.ts:10:5</failure></testcase></testsuite>'],
    ['sarif.json', JSON.stringify({version:'2.1.0', runs:[{tool:{driver:{name:'eslint'}}, results:[{level:'error', message:{text:'boom'}, locations:[{physicalLocation:{artifactLocation:{uri:'src/app.ts'}}}]}]}]}, null, 2)],
    ['ansi.log', '\u001b[31mFAIL\u001b[0m src/app.test.ts > boom\n\u001b[31mAssertionError: expected 1 to equal 2\u001b[0m\n  at \u001b[33msrc/app.ts:10:5\u001b[0m'],
    ['unicode.log', 'Error: boom 💥 at src/ünicode.ts:10:5\nTests  1 failed — café naïve résumé'],
    ['generic-fail.log', f.genericFailFixture()],
  ];
  for(const [name,content] of entries){
    const full=path.join(dir,name);
    if(!fs.existsSync(full)) fs.writeFileSync(full,content);
  }
  console.log(`corpus-builder: ensured ${entries.length} entries in ${dir}`);
}
if(require.main===module) synthCorpus();
module.exports={synthCorpus};
