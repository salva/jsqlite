// Native receipt must be captured first by where-bloom-boundaries-native.py.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {openFixture,privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../test/conformance/close-test-server.mjs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect,programOpcodeNames,programControlTargets} from '../../src/internal/vdbe.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
const native=JSON.parse(fs.readFileSync(process.argv[2]));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,pin.sqliteSourceId);
function cell(s,i){const type=s.columnType(i),value=s.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};throw Error(`unexpected witness type ${type}`);}
for(const v of native.variants){
 const bytes=fs.readFileSync(v.fixture);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  try{for(const c of v.cases){
   if(c.case==='skip-range'||c.case==='skip-equality'||c.case==='skip-group'){
    const storage=ImmutableStorage.open(bytes);
    try{
     const schema=loadSchemaGraph({[storageOwner]:storage}),resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema);
     const path=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]}).path;
     assert.ok(path?.loops.some(l=>(l.capability?.nSkip??0)>0),'actual selected skip-scan loop');
    }finally{storage.close();}
   }
   if(c.case==='skip-group'){
    const storage=ImmutableStorage.open(bytes);
    try{
     const schema=loadSchemaGraph({[storageOwner]:storage}),p=compileTableSelect(parseSql(c.sql).statement,schema,btreeFromStorage(storage),Number.MAX_SAFE_INTEGER),names=programOpcodeNames(p);
     const filters=names.flatMap((n,i)=>n==='Filter'?[i]:[]),seeks=filters.map(at=>names.findIndex((n,i)=>i>at&&n==='IndexSeekPrefix'));
     assert.equal(filters.length,2);assert.equal(seeks.length,2);
     assert.ok(filters[0]<seeks[0]&&seeks[0]<filters[1]&&filters[1]<seeks[1]);
     assert.equal(names.filter((n,i)=>n==='Once'&&i<seeks[1]).length,2,'skip builds retain native prerequisite placement');
     const nf=c.program.filter(o=>o.opcode==='Filter'),ns=c.program.filter(o=>o.opcode==='SeekGE');
     assert.equal(nf.length,2);assert.equal(ns.length,2);assert.ok(nf[0].addr<ns[0].addr&&ns[0].addr<nf[1].addr&&nf[1].addr<ns[1].addr);
     assert.equal(c.program.filter(o=>o.opcode==='Once'&&o.addr<ns[1].addr).length,2);
    }finally{storage.close();}
   }
   if(c.case==='group-outer'){
    const storage=ImmutableStorage.open(bytes);
    try{
     const schema=loadSchemaGraph({[storageOwner]:storage});
     const p=compileTableSelect(parseSql(c.sql).statement,schema,btreeFromStorage(storage),Number.MAX_SAFE_INTEGER);
     const names=programOpcodeNames(p),filters=names.flatMap((n,i)=>n==='Filter'?[i]:[]),seeks=names.flatMap((n,i)=>n==='IndexSeekPrefix'?[i]:[]);
     assert.equal(filters.length,2);assert.equal(seeks.length,2);
     assert.ok(filters[0]<seeks[0]&&seeks[0]<filters[1]&&filters[1]<seeks[1]);
     assert.equal(names.filter(n=>n==='Once').length,2);
     const targets=programControlTargets(p).filter(t=>t.code==='Filter');assert.notEqual(targets[0].target,targets[1].target);
     const nf=c.program.filter(o=>o.opcode==='Filter'),ns=c.program.filter(o=>o.opcode==='SeekGE');
     assert.equal(nf.length,2);assert.equal(ns.length,2);assert.ok(nf[0].addr<ns[0].addr&&ns[0].addr<nf[1].addr&&nf[1].addr<ns[1].addr);
     assert.equal(c.program.filter(o=>o.opcode==='Once'&&o.addr<ns[1].addr).length,2);assert.notEqual(nf[0].p2,nf[1].p2);
    }finally{storage.close();}
   }
   if(c.case.startsWith('derived-')){
    const storage=ImmutableStorage.open(bytes);
    try{
     const schema=loadSchemaGraph({[storageOwner]:storage});
     const p=compileTableSelect(parseSql(c.sql).statement,schema,btreeFromStorage(storage),Number.MAX_SAFE_INTEGER),names=programOpcodeNames(p);
     const filter=names.indexOf('Filter'),add=names.indexOf('FilterAdd'),seek=names.findIndex((n,i)=>i>filter&&n==='IndexSeekPrefix');
     assert.ok(add>=0&&add<filter&&filter<seek,'physical build, probe and authoritative seek');
     const calls=programControlTargets(p).filter(t=>t.code==='Gosub');
     assert.equal(calls.length,1,'one retained materialized source invocation');
     const nf=c.program.find(o=>o.opcode==='Filter'),na=c.program.find(o=>o.opcode==='FilterAdd');
     const call=c.program.find(o=>o.opcode==='Gosub'&&o.addr>nf.addr);
     assert.ok(na.addr<nf.addr&&call,'native materialized invocation after physical probe');
     assert.ok(calls[0].index>seek);
    }finally{storage.close();}
   }
   if(c.case==='frame-bloom'||c.case==='frame-first'){
    // Child WHERE work shares the builder but retains its own Once and cursor
    // IDs. Demand native construction/probe structure, not only equal rows.
    const nf=c.program.filter(o=>o.opcode==='Filter'),adds=c.program.filter(o=>o.opcode==='FilterAdd');
    assert.equal(nf.length,1);assert.equal(adds.length,1);assert.ok(adds[0].addr<nf[0].addr);
    assert.ok(c.program.some(o=>o.opcode==='Once'&&o.addr<adds[0].addr));
   }
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.columns);
    for(const expected of c.runs){
     const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));
     assert.deepEqual(rows,expected,`${v.encoding} ${c.case}`);
     const o=privateAccounting(s);assert.equal(o.ownedBytes,0);assert.equal(o.openCursors,0);
     if(c.case==='frame'||c.case==='skip-range'){assert.equal(o.filterAdds,0);assert.equal(o.probes,0);}
     else {assert.equal(o.planKind,'standalone-bloom');assert.ok(o.filterAdds>0);assert.ok(o.probes>0);assert.ok(o.indexSeeks>0);}
     console.log(v.encoding,c.case,'native rows/metadata/reset/release passed',JSON.stringify({filterAdds:o.filterAdds,probes:o.probes,planKind:o.planKind}));
     s.reset();
    }
   }finally{s.finalize();}
  }}finally{db.close();}
 }finally{await closeTestServer(server);}
}
