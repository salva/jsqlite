import assert from 'node:assert/strict';

// Preserve every case failure, including cleanup, without allowing finalize to
// hide the owning step mismatch or prevent the rest of the inventory running.
export async function checkPathCases(db,cases){
 const failures=[];
 const checkError=(error,expected)=>{
  assert.ok(error,'expected SQLite error');
  assert.equal(error.kind,'sqlite');assert.equal(error.code,expected.code);
  assert.equal(error.extendedCode,expected.extendedCode);assert.equal(error.message,expected.error);
 };
 for(const expected of cases){let s;
  const record=(phase,error)=>failures.push({sql:expected.sql,phase,error:error.stack??String(error)});
  try{
   s=db.prepare(expected.sql).statement;
   assert.equal(s.columnCount,1);
   assert.deepEqual(s.columnMetadata(0),{name:expected.name,declaredType:null,database:null,table:null,origin:null});
   for(let run=0;run<2;run++){
    let error;
    try{
     assert.equal(await s.step(),'row');
     const type=s.columnType(0),value=s.column(0);
     assert.equal(type,expected.type);
     if(type==='real')assert.equal(value,Number(expected.value));
     else assert.equal(value===null?null:type==='blob'?Buffer.from(value).toString('hex').toUpperCase():String(value),expected.value);
     assert.equal(await s.step(),'done');
    }catch(e){error=e;}
    try{if(expected.error)checkError(error,expected);else if(error)throw error;}
    catch(e){record(`step ${run}`,e);}
    try{s.reset()}catch(e){try{checkError(e,expected)}catch(mismatch){record(`reset ${run}`,mismatch)}}
   }
  }catch(e){record('prepare/metadata',e)}
  finally{try{s?.finalize()}catch(e){try{checkError(e,expected)}catch(mismatch){record('finalize',mismatch)}}}
 }
 assert.deepEqual(failures,[]);
}
