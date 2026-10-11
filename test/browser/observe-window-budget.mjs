// Dev-only ownership observation, not shipped or imported by browser runtime.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {open} from '../../dist/index.js';
import {PrivateStateByteBudget,SorterCursor,EphemeralIndexCursor} from '../../dist/internal/private-state.js';
const original=PrivateStateByteBudget.prototype.reserve,release=PrivateStateByteBudget.prototype.release,insertS=SorterCursor.prototype.insert,insertE=EphemeralIndexCursor.prototype.insert,deleteE=EphemeralIndexCursor.prototype.deleteCurrent,nextE=EphemeralIndexCursor.prototype.next;
const transitions=[];
PrivateStateByteBudget.prototype.release=function(bytes){const before=this.usedBytes;const result=release.call(this,bytes);transitions.push({op:'release',before,bytes,after:this.usedBytes});return result};
EphemeralIndexCursor.prototype.deleteCurrent=async function(...args){transitions.push({op:'delete'});return deleteE.apply(this,args)};
EphemeralIndexCursor.prototype.next=function(...args){const result=nextE.apply(this,args);transitions.push({op:'next',result});return result};
let kind='other';const events=[];const ids=new WeakMap();let next=0;
PrivateStateByteBudget.prototype.reserve=function(bytes,message){if(!ids.has(this))ids.set(this,++next);events.push({budget:ids.get(this),kind,before:this.usedBytes,bytes});return original.call(this,bytes,message)};
SorterCursor.prototype.insert=async function(...args){kind='sorter';try{return await insertS.apply(this,args)}finally{kind='other'}};
EphemeralIndexCursor.prototype.insert=async function(...args){kind='ephemeral';try{return await insertE.apply(this,args)}finally{kind='other'}};
const bytes=fs.readFileSync('test/fixtures/aggregate-window/w2rows.db');const server=http.createServer((req,res)=>res.end(bytes));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,s;
try{db=await open(`http://127.0.0.1:${server.address().port}/db`);s=db.prepare('SELECT a, sum(d) OVER (ORDER BY d ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1').statement;while(await s.step()==='row'){};
assert(events.some(e=>e.kind==='sorter'));assert(events.some(e=>e.kind==='ephemeral'&&e.before>0));assert.equal(new Set(events.map(e=>e.budget)).size,1);
// window.c windowCodeOp emits phase Delete before Next (SAVEPOSITION).
// Logical TS bytes include transient packed records; not native heap parity.
assert.equal(Math.max(...events.map(e=>e.before+e.bytes)),359);
assert.equal(events.filter(e=>e.kind==='sorter').reduce((n,e)=>n+e.bytes,0),192);
assert(events.some(e=>e.before===264&&e.bytes===71));
assert(transitions.some(e=>e.op==='delete'));
for(let i=0;i<transitions.length;i++)if(transitions[i].op==='delete'){
 assert.equal(transitions[i+1]?.op,'release');assert.equal(transitions[i+1]?.bytes,24);
 assert.equal(transitions[i+2]?.op,'next','phase Delete then Next, not refund on consumed sorter');
}
assert.equal(transitions.at(-1)?.after,0,'halt releases the shared budget');
transitions.push({op:'public-done'}); // step loop terminated with done; VM may test hasNext instead of calling Next at EOF.
const firstTrace={events:[...events],transitions:[...transitions]};
s.reset();events.length=0;transitions.length=0;while(await s.step()==='row'){};
assert.equal(Math.max(...events.map(e=>e.before+e.bytes)),359,'reset has no stale cursor/cache budget');
assert.equal(new Set(events.map(e=>e.budget)).size,1);
console.log(JSON.stringify({firstTrace,resetTrace:{events,transitions},interpretation:'retained sorter192 + live frame96 + transient packed71 =359; Delete releases frame rows before subsequent Next; EOF and reset reexecution observed'},null,2));
}finally{try{s?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.close(r));PrivateStateByteBudget.prototype.reserve=original;PrivateStateByteBudget.prototype.release=release;EphemeralIndexCursor.prototype.deleteCurrent=deleteE;EphemeralIndexCursor.prototype.next=nextE;SorterCursor.prototype.insert=insertS;EphemeralIndexCursor.prototype.insert=insertE}}
