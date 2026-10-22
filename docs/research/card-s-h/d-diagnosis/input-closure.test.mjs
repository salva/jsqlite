import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../../../../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('affected-inputs.json',import.meta.url)));
const entries=Object.entries(manifest.sha256);
// Revision-bound receipt, not a claim that later runtime sources are identical.
// Native fixtures consumed here must still retain authenticated acquired bytes.
const acquired=entries.filter(([path])=>path.endsWith('.db')||path.endsWith('.json'));
function verify(read,inputs=entries){
 for(const [path,expected] of inputs){
  assert.match(expected,/^[a-f0-9]{64}$/);
  assert.equal(createHash('sha256').update(read(path)).digest('hex'),expected,path);
 }
}
const historical=path=>execFileSync('git',['show',`${manifest.runtimeCommit}:${path}`],{cwd:root,maxBuffer:16*1024*1024});
const read=path=>fs.readFileSync(new URL(path,root));
test('historical STAT4 runtime, tests and native inputs match their committed closure',()=>{
 assert.equal(manifest.runtimeCommit,'40ab4992141e757c229e7d6d31403487757256f9');
 const paths=Object.keys(manifest.sha256);
 for(const category of ['src/','test/conformance/stat4-','docs/research/card-s-h/'])assert.ok(paths.some(p=>p.startsWith(category)));
 for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])assert.ok(paths.includes(`docs/research/card-s-h/${encoding}.db`));
 verify(historical);
});
test('historical closure rejects altered source bytes',()=>{
 const target='src/internal/btree.ts';
 assert.throws(()=>verify(path=>{
  const bytes=historical(path);
  if(path!==target)return bytes;
  const changed=Buffer.from(bytes);changed[0]^=1;return changed;
 }),error=>error.code==='ERR_ASSERTION'&&error.message.includes(target));
});
test('currently consumed acquired STAT4 fixtures retain authenticated historical bytes',()=>{
 assert.ok(acquired.length>0);
 verify(read,acquired);
});
test('closure guard rejects altered native sample bytes rather than laundering mixed input evidence',()=>{
 const target='docs/research/card-s-h/UTF-8.db';
 assert.throws(()=>verify(path=>{
  const bytes=read(path);
  if(path!==target)return bytes;
  const changed=Buffer.from(bytes);changed[changed.length-1]^=1;return changed;
 },acquired),error=>error.code==='ERR_ASSERTION'&&error.message.includes(target));
});
