// Isolated build-cache controls using the real pinned compiler, never engine edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
assert(process.env.SAIVAGE_CARD_WORK_ROOT);
const root = path.join(process.env.SAIVAGE_CARD_WORK_ROOT, 'package-build-controls');
fs.mkdirSync(root); // exclusive: do not erase previous evidence
for (const p of ['tools/package','src','node_modules']) fs.mkdirSync(path.join(root,p),{recursive:true});
fs.copyFileSync('tools/package/build.mjs',path.join(root,'tools/package/build.mjs'));
fs.symlinkSync(path.resolve('node_modules/typescript'),path.join(root,'node_modules/typescript'),'dir');
const put=(p,s)=>fs.writeFileSync(path.join(root,p),s);
put('package.json','{"type":"module"}'); put('package-lock.json','{}');
put('tsconfig.json','{"compilerOptions":{"target":"ES2022","module":"NodeNext","strict":true,"skipLibCheck":false}}');
put('tsconfig.build.json','{"extends":"./tsconfig.json","compilerOptions":{"declaration":true,"outDir":"dist"},"include":["src/**/*.ts"]}');
put('src/index.ts','export const value: number = 1;');
function run(hit=false,ok=true){
 const r=spawnSync(process.execPath,['tools/package/build.mjs'],{cwd:root,encoding:'utf8'});
 assert.equal(r.status===0,ok,r.stdout+r.stderr);
 assert.equal(r.stderr.includes('Restored verified'),hit,r.stdout+r.stderr);
 return r;
}
run(); const original=fs.readFileSync(path.join(root,'dist/index.js'));
put('dist/stale.js','stale'); put('dist/index.js','damaged'); run(true);
assert(!fs.existsSync(path.join(root,'dist/stale.js')));
assert.deepEqual(fs.readFileSync(path.join(root,'dist/index.js')),original);
const cache=path.join(root,'build/package-cache');
let key=fs.readdirSync(cache)[0];
put(`build/package-cache/${key}/dist/index.js`,'corrupt'); run();
assert.deepEqual(fs.readFileSync(path.join(root,'dist/index.js')),original);
put('src/removed.ts','export const removed = 1;'); run();
assert(fs.existsSync(path.join(root,'dist/removed.js')));
fs.unlinkSync(path.join(root,'src/removed.ts')); run(true);
assert(!fs.existsSync(path.join(root,'dist/removed.js')));
put('src/index.ts','export const value: number = 2;'); run();
assert(fs.readFileSync(path.join(root,'dist/index.js'),'utf8').includes('2'));
put('tsconfig.json','{"compilerOptions":{"target":"ES2020","module":"NodeNext","strict":true}}'); run();
put('src/index.ts','export const value: number = "bad";'); run(false,false);
assert(!fs.existsSync(path.join(root,'dist')),'failed compiler must remove partial output');
put('src/index.ts','export const value: number = 2;'); run(true);
// Build implementation and lock/compiler-identity inputs must also invalidate.
fs.appendFileSync(path.join(root,'tools/package/build.mjs'),'\n// control\n'); run();
put('package-lock.json','{"control":true}'); run();
// Compare cached output to an independent cold rebuild, not only itself.
const before=fs.readFileSync(path.join(root,'dist/index.d.ts'));
fs.rmSync(cache,{recursive:true}); run();
assert.deepEqual(fs.readFileSync(path.join(root,'dist/index.d.ts')),before);
console.log('PASS: build snapshot restore, stale/damaged output, corruption, added/removed/changed source, config/build/lock invalidation, failed build cleanup, cold equivalence');
