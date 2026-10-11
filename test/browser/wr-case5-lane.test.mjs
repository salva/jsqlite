import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('real browser runner declares native-backed selected WR Case5 lane',()=>{
 const runner=fs.readFileSync('test/browser/run.mjs','utf8');
 assert.ok(runner.includes('docs/research/card-s-i/native.json'),'load independent WR oracle');
 assert.ok(runner.includes('wr-case5/'),'named selected consuming browser cases');
});
