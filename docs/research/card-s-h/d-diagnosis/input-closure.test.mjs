import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('affected-inputs.json',import.meta.url)));
function verify(read){
 for(const [path,expected] of Object.entries(manifest.sha256)){
  assert.match(expected,/^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(read(path)).digest('hex'),expected,path);
 }
}
const read=path=>fs.readFileSync(new URL(path,root));
test('finite STAT4 runtime, source-based tests and acquired native inputs match explicit closure hashes',()=>{
 assert.equal(manifest.runtimeCommit,'ff4eabdfa526eee3489c9e781adddc7356ee0819');
 const paths=Object.keys(manifest.sha256);
 for(const category of ['src/','test/conformance/stat4-','docs/research/card-s-h/'])assert.ok(paths.some(p=>p.startsWith(category)));
 for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])assert.ok(paths.includes(`docs/research/card-s-h/${encoding}.db`));
 verify(read);
});
test('closure guard rejects altered native sample bytes rather than laundering mixed input evidence',()=>{
 const target='docs/research/card-s-h/UTF-8.db';
 assert.throws(()=>verify(path=>{
  const bytes=read(path);
  if(path!==target)return bytes;
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;return changed;
 }),error=>error.code==='ERR_ASSERTION'&&error.message.includes(target));
});
