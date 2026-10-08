// Development-only immutable Chinook prerequisite. Never imported by runtime.
import {readFile, mkdir, writeFile, rename, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const chinookIdentity = Object.freeze({bytes:1007616, sha256:'7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15'});
const vendored = fileURLToPath(new URL('../examples/browser/chinook.sqlite', import.meta.url));
function validate(bytes, path) {
  if(bytes.length!==chinookIdentity.bytes || createHash('sha256').update(bytes).digest('hex')!==chinookIdentity.sha256)
    throw Error(`Chinook fixture identity mismatch: ${path}`);
}
export async function chinookFixture({workRoot=process.env.SAIVAGE_CARD_WORK_ROOT, source=vendored}={}) {
  const bytes=await readFile(source); validate(bytes,source);
  // Unscoped direct execution still asserts the same immutable fixture, never skips.
  if(!workRoot)return source;
  const dir=join(workRoot,'chinook-fixture'), target=join(dir,'Chinook_Sqlite.sqlite');
  await mkdir(dir,{recursive:true});
  try {validate(await readFile(target),target); return target;}
  catch(error) {if(error.code!=='ENOENT')throw error;}
  const temporary=join(dir,`.chinook-${randomUUID()}`);
  try {await writeFile(temporary,bytes,{flag:'wx'}); await rename(temporary,target);}
  finally {await rm(temporary,{force:true});}
  validate(await readFile(target),target);
  return target;
}
