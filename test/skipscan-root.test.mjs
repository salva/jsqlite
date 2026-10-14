import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {skipscanRoot} from './skipscan-root.mjs';

test('fixture consumers preserve legacy URL or resolve explicit purpose root',()=>{
 const old=process.env.SKIPSCAN_NATIVE_ROOT;
 const legacy=new URL('../docs/research/card-s-g/',import.meta.url);
 try{
  delete process.env.SKIPSCAN_NATIVE_ROOT;
  assert.equal(skipscanRoot(legacy),legacy);
  const absent=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'explicit-absent-root');
  assert.equal(fs.existsSync(absent),false);
  process.env.SKIPSCAN_NATIVE_ROOT=absent;
  const root=skipscanRoot(legacy);
  assert.equal(root.href,pathToFileURL(absent+path.sep).href);
  assert.equal(new URL('primitive-companions/native.json',root).href,
   pathToFileURL(path.join(absent,'primitive-companions/native.json')).href);
  // Explicit absent roots are not silently replaced by source fixtures.
  assert.notEqual(root.href,legacy.href);
  assert.throws(()=>fs.readFileSync(new URL('primitive-companions/native.json',root)),e=>e.code==='ENOENT');
 }finally{
  if(old===undefined)delete process.env.SKIPSCAN_NATIVE_ROOT;
  else process.env.SKIPSCAN_NATIVE_ROOT=old;
 }
});
