import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-r-a-json-encoding-native.json',import.meta.url)));
assert.equal(native.version,'3.53.4');
assert.equal(native.sourceId,'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc');
// Join receipts by exact original file identity and row order, never candidate output.
// Keep original suite loops, SQL, bindings, and lifecycle controls in their owners.
export function encodingCases(suite,url,enc,sql){
 const bytes=readFileSync(url),rows=JSON.parse(bytes),data=native.suites[suite];
 assert.equal(createHash('sha256').update(bytes).digest('hex'),data.inputSha256);
 assert.deepEqual(rows,data.inputs);
 assert.equal(sql,data.sql);
 assert.equal(data.encodings[enc].length,rows.length);
 return rows.map((row,i)=>{
  const receipt=data.encodings[enc][i];
  const values=(kind,types)=>{
   const steps=receipt[kind].steps;
   assert.equal(steps.length,2);
   assert.deepEqual(steps[0],steps[1]);
   if(steps[0].error){assert.equal(kind,'render');assert.equal(steps[0].code,1);return {error:steps[0].error};}
   assert.deepEqual(steps[0].values.map(v=>v.type),types);
   return steps[0].values.map(v=>v.value);
  };
  return {...row,expected:values('validation',row.expected.map(()=> 'integer')),
   ...(row.render?{render:values('render',['text','text'])}:{}),
   ...(row.composition?{composition:values('composition',['text','text','text'])}:{})};
 });
}
