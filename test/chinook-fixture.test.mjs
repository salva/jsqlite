import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {chinookFixture} from './chinook-fixture.mjs';
test('local Chinook provisions fresh scoped root, repeats/concurrent calls and rejects corruption',async()=>{
 const root=process.env.SAIVAGE_CARD_WORK_ROOT;assert.ok(root,'SAIVAGE_CARD_WORK_ROOT required');
 const dir=await mkdtemp(join(root,'chinook-unit-'));
 try {
  const paths=await Promise.all([chinookFixture({workRoot:dir}),chinookFixture({workRoot:dir})]);assert.equal(paths[0],paths[1]);
  assert.equal(await chinookFixture({workRoot:dir}),paths[0]);assert.equal((await readFile(paths[0])).length,1007616);
  const bad=join(dir,'bad.sqlite');await writeFile(bad,'wrong');
  await assert.rejects(chinookFixture({workRoot:dir,source:bad}),/identity mismatch/);
  await assert.rejects(chinookFixture({workRoot:dir,source:join(dir,'missing')}),{code:'ENOENT'});
  await writeFile(paths[0],'wrong');await assert.rejects(chinookFixture({workRoot:dir}),/identity mismatch/);
  assert.equal((await readFile(paths[0])).toString(),'wrong');
  assert.ok((await chinookFixture({workRoot:null})).endsWith('examples/browser/chinook.sqlite'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
