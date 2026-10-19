import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// jsonObjectStep measures the UTF-8 prefix; jsonAppendString copies non-control
// bytes verbatim. Inspect hex before the public JS-string decoding boundary.
for(const binary of [false,true]) {
 test(`${binary?'jsonb':'json'} object aggregate preserves malformed label bytes before NUL`,async()=>{
  const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
   for(const [label,textHex,jsonbHex] of [
    ["x'610062'",'7B2261223A317D','4C17611331'],
    ["x'ff0062'",'7B22FF223A317D','4C17FF1331'],
    ["x'c30062'",'7B22C3223A317D','4C17C31331'],
    ["x'c3a90062'",'7B22C3A9223A317D','5C27C3A91331'],
    ["x'ff225c0108090a0c0d00'",'7B22FF5C225C5C5C75303030315C625C745C6E5C665C72223A317D','CC19C815FF5C225C5C5C75303030315C625C745C6E5C665C721331'],
   ]) {
    const name=binary?'jsonb_group_object':'json_group_object';
    const s=db.prepare(`SELECT hex(${name}(${label},1)) FROM t1 WHERE x=0`).statement;
    try{assert.equal(await s.step(),'row');assert.equal(s.column(0),binary?jsonbHex:textHex,label)}finally{s.finalize()}
   }
   // Direct window bytes avoid decoding malformed text at the host boundary.
   const name=binary?'jsonb_group_object':'json_group_object';
   const s=db.prepare(`SELECT ${name}(x'ff0062',x) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<3 ORDER BY x`).statement;
   if(binary)try{
    for(const expected of ['4C17FF1330','8C17FF133017FF1331','8C17FF133117FF1332']){assert.equal(await s.step(),'row');assert.equal(Buffer.from(s.column(0)).toString('hex').toUpperCase(),expected)}
    s.reset();assert.equal(await s.step(),'row');assert.equal(Buffer.from(s.column(0)).toString('hex').toUpperCase(),'4C17FF1330');
   }finally{s.finalize()}
   else s.finalize(); // Text host values decode bytes; SQL hex windows are not represented.
  }finally{try{db?.closeDeferred()}finally{await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}}
 });
}
