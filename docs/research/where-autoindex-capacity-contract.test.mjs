// Synthetic assertion-driver tests, not runtime capacity acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {capacity} from './where-autoindex-pending-controls.mjs';
const expected={rows:[],columns:[],work:{buildRows:1,probes:1,absent:0,collisions:0}};
function adapter(mutate=()=>{}) {return {
 async measureHighWater(d){assert.ok(['maxBytes','maxEntries','maxKeyBytes'].includes(d));return 10},
 async executeWithLimit(dimension,limit){const failed=limit<10;
 const r={dimension,fallback:false,error:failed?{name:'PrivateStateLimitError'}:null,publishedResultRows:0,
  rows:[],columns:[],version:1,planKind:'automatic-index',executedOps:['OpenAutoindex','FilterAdd','Filter'],builds:1,insertedRecords:1,probes:1,filterAbsent:0,filterPresent:1,indexSeeks:1,collisionRejects:0,coveringTableLookups:0,
  released:{ownerId:1,chargedBytes:10,refundedBytes:10,ownedBytes:0,openCursors:0,filterBytes:0,onceActive:false},independentBefore:{ownerId:2,ownedBytes:5},independentAfter:{ownerId:2,ownedBytes:5}};
 mutate(r,failed);return r}}}
test('capacity driver covers each dimension below at and above exact boundary',async()=>{
 await capacity(adapter(),expected);
});
test('capacity driver rejects fallback wrong boundary result publication and incomplete refund',async()=>{
 for(const mutate of [r=>r.dimension='wrong',r=>r.fallback=true,(r,f)=>{if(f)r.error=null},
 (r,f)=>{if(f)r.publishedResultRows=1},(r,f)=>{if(!f)r.rows=[[{type:'null'}]]},
 (r,f)=>{if(!f)r.builds=0},r=>r.released.refundedBytes=9])
  await assert.rejects(capacity(adapter(mutate),expected));
});
