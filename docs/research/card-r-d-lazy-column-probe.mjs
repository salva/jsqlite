const root=process.env.SAIVAGE_CARD_WORK_ROOT+'/lazy-column-red/source';
const {Mem}=await import(root+'/src/internal/mem.ts');
const {openFixture}=await import(root+'/test/conformance/public-api-adapter.mjs');
const {startFixtureServer}=await import(root+'/test/conformance/fixture-server.mjs');
const {closeTestServer}=await import(root+'/test/conformance/close-test-server.mjs');
const bridge=await startFixtureServer(root+'/test/fixtures');
const original=Mem.prototype.copyFrom;let active=false,copies=0,bytes=0,blobs=0;
const document='['+Array.from({length:16},(_,i)=>i).join(',')+']';
Mem.prototype.copyFrom=function(source){if(active){if(source.initialStorageClass==='text'&&source.textValue()===document){copies++;bytes+=source.textBytes().byteLength;}if(source.initialStorageClass==='blob'){blobs++;bytes+=source.blobValue().byteLength;}}return original.call(this,source)};
try{for(const encoding of ['utf8','utf16le','utf16be']){
const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
try{for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree'])for(const binary of [false,true]){
const arg=binary?`jsonb('${document}')`:`'${document}'`;
for(const [kind,sql] of [
['rejected',`SELECT json FROM ${module}(${arg}) WHERE key<0`],
['case',`SELECT CASE WHEN key<0 THEN json ELSE 'ok' END FROM ${module}(${arg})`],
['coalesce',`SELECT coalesce('ok',json) FROM ${module}(${arg})`],
['exists',`SELECT EXISTS(SELECT json FROM ${module}(${arg}) WHERE key>=0)`],
['explicit',`SELECT json FROM ${module}(${arg})`]]){
let s;copies=0;bytes=0;blobs=0;let rows=0,error=null,types=[];
try{s=db.prepare(sql).statement;active=true;while(await s.step()==='row'){rows++;types.push(s.columnType(0));}}catch(e){error={kind:e.kind,message:e.message};}finally{active=false;try{s?.finalize()}catch{}}
console.log(JSON.stringify({encoding,module,binary,kind,rows,copies,blobs,bytes,types,error,sql}));
}}}finally{db.closeDeferred();}
}}finally{active=false;Mem.prototype.copyFrom=original;await closeTestServer(bridge.server);}
