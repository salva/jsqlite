import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Pinned native witnesses/provenance: docs/research/card-r-e-jsonb-error-position-review.md.
// SQL hex consumes the JSONB BLOB directly, avoiding TEXT-result encoding ambiguity.
test('public JSONB labels respect database encoding for literal and API BLOB producers',async()=>{
 const fixtures=new Map(['UTF-8','UTF-16le','UTF-16be'].map(enc=>[enc,fs.readFileSync(new URL(`../fixtures/wr-case5-mixed-${enc}.db`,import.meta.url))]));
 const server=http.createServer((req,res)=>{const b=fixtures.get(req.url.slice(1));if(!b){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Length':b.length});res.end(b)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [enc,label,expected] of [['UTF-8','610062','4C17611331'],['UTF-16be','610062','6C37E684801331'],['UTF-16le','ff0062','5C27C3BF1331']]){
  const db=await open(new Request(`http://127.0.0.1:${server.address().port}/${enc}`));
  try{for(const [sql,binding,want] of [
   [`SELECT hex(jsonb_group_object(x'${label}',1))`,null,expected],
   ['SELECT hex(jsonb_group_object(?1,1))',Uint8Array.of(0x61,0,0x62),enc==='UTF-16be'?'6C37E684801331':'4C17611331'],
   ["SELECT hex(jsonb_group_object(NULL,x'ff'))",null,'0C'],
   [`SELECT hex(x'${label}')`,null,label.toUpperCase()],
  ]){const s=db.prepare(sql).statement;try{if(binding)s.bind(1,binding);for(let pass=0;pass<2;pass++){assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');assert.equal(s.column(0),want,`${enc}: ${sql}`);s.reset()}}finally{s.finalize()}}
  }finally{db.close()}
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
