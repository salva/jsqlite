import assert from 'node:assert/strict';
// Whole-statement native rows preserve error priority for multi-column SQL.
export async function checkPrettyBlobCases(db,cases){
 const failures=[];
 for(const expected of cases){let s;
  const record=(phase,e)=>failures.push({sql:expected.sql,phase,error:e.stack??String(e)});
  const checkError=e=>{assert.equal(e?.kind,'sqlite');assert.equal(e.code,expected.code);assert.equal(e.extendedCode,expected.extendedCode);assert.equal(e.message,expected.error)};
  try{
   s=db.prepare(expected.sql).statement;
   assert.equal(s.columnCount,expected.metadata.length);
   for(let i=0;i<s.columnCount;i++)assert.deepEqual(s.columnMetadata(i),expected.metadata[i]);
   for(let run=0;run<2;run++){
    try{
     for(const row of expected.rows){assert.equal(await s.step(),'row');for(let i=0;i<row.length;i++){
      const {type,value}=row[i];assert.equal(s.columnType(i),type);const actual=s.column(i);
      assert.equal(type==='blob'?Buffer.from(actual).toString('hex').toUpperCase():type==='real'?Number(actual):actual===null?null:String(actual),type==='real'?Number(value):value);
     }}
     if(expected.error){let e;try{await s.step()}catch(error){e=error}checkError(e)}else assert.equal(await s.step(),'done');
    }catch(e){record(`step ${run}`,e)}
    try{let error;try{s.reset()}catch(e){error=e}if(expected.error)checkError(error);else assert.equal(error,undefined)}catch(e){record(`reset ${run}`,e)}
   }
  }catch(e){record('prepare/metadata',e)}
  finally{try{s?.finalize()}catch(e){try{checkError(e)}catch(m){record('finalize',m)}}}
 }
 assert.deepEqual(failures,[]);
}
