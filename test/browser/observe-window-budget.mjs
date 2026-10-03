// Dev-only ownership observation, not shipped or imported by browser runtime.
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {open} from '../../dist/index.js';
import {PrivateStateByteBudget,SorterCursor,EphemeralIndexCursor} from '../../dist/internal/private-state.js';
const original=PrivateStateByteBudget.prototype.reserve,insertS=SorterCursor.prototype.insert,insertE=EphemeralIndexCursor.prototype.insert;
let kind='other';const events=[];const ids=new WeakMap();let next=0;
PrivateStateByteBudget.prototype.reserve=function(bytes,message){if(!ids.has(this))ids.set(this,++next);events.push({budget:ids.get(this),kind,before:this.usedBytes,bytes});return original.call(this,bytes,message)};
SorterCursor.prototype.insert=async function(...args){kind='sorter';try{return await insertS.apply(this,args)}finally{kind='other'}};
EphemeralIndexCursor.prototype.insert=async function(...args){kind='ephemeral';try{return await insertE.apply(this,args)}finally{kind='other'}};
const bytes=fs.readFileSync('test/fixtures/aggregate-window/w2rows.db');const server=http.createServer((req,res)=>res.end(bytes));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,s;
try{db=await open(`http://127.0.0.1:${server.address().port}/db`);s=db.prepare('SELECT a, sum(d) OVER (ORDER BY d ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1').statement;while(await s.step()==='row'){};
assert(events.some(e=>e.kind==='sorter'));assert(events.some(e=>e.kind==='ephemeral'&&e.before>0));assert.equal(new Set(events.map(e=>e.budget)).size,1);console.log(JSON.stringify({events,interpretation:'same execution budget; ephemeral reserve while existing sorter bytes remain reserved; source VM clears sorter only after drain'},null,2));
}finally{try{s?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.close(r));PrivateStateByteBudget.prototype.reserve=original;SorterCursor.prototype.insert=insertS;EphemeralIndexCursor.prototype.insert=insertE}}
