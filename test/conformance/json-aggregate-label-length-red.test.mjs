import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// json.c:jsonObjectStep measures label text with sqlite3Strlen30, whereas
// jsonAppendSqlValue measures value text with sqlite3_value_bytes.
for(const name of ['json_group_object','jsonb_group_object']) {
 test(`${name} distinguishes label NUL termination from value byte length`,async()=>{
  const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
   for(const [label,value,expected] of [
    ["'a'","char(97,0,98)",'{"a":"a\\u0000b"}'],
    ["char(97,0,98)",'1','{"a":1}'],
    ["char(0,98)",'1','{"":1}'],
    ["char(233,0,98)",'1','{"é":1}'],
    ["char(97,0)",'1','{"a":1}'],
    ["''",'1','{"":1}'],
    ['9223372036854775807','1','{"9223372036854775807":1}'],
    ['1.5','1','{"1.5":1}'],
    ["x'610062'",'1','{"a":1}'],
    ["x'c3a90062'",'1','{"é":1}'],
    ["json('1')",'1','{"1":1}'],
   ]) {
    const expr=`${name}(${label},${value})`;
    const s=db.prepare(`SELECT ${name.startsWith('jsonb')?`json(${expr})`:expr} FROM t1 WHERE x=0`).statement;
    try{assert.equal(await s.step(),'row');assert.equal(s.column(0),expected,`${name} label=${label} value=${value}`)}finally{try{s.finalize()}catch{}}
   }
   // Sliding inverse must remove the row, not a prefix-equivalent label.
   const s=db.prepare(`SELECT ${name}(char(97+x,0,120),x) OVER (ORDER BY x ROWS 1 PRECEDING) FROM t1 WHERE x<3 ORDER BY x`).statement;
   const expected=name.startsWith('jsonb')?['4C17611330','8C1761133017621331','8C1762133117631332']:['{"a":0}','{"a":0,"b":1}','{"b":1,"c":2}'];
   try{for(const value of expected){assert.equal(await s.step(),'row');const actual=s.column(0);assert.equal(actual instanceof Uint8Array?Buffer.from(actual).toString('hex').toUpperCase():actual,value)}s.reset();assert.equal(await s.step(),'row')}finally{s.finalize()}
  }finally{try{db?.closeDeferred()}finally{await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}}
 });
}
