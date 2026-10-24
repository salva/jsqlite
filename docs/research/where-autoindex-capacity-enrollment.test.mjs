// Capacity enrollment regression; native/public execution evidence lives in card status.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('original capacity consumer reaches two-filter placement with pre-publication ordering',()=>{
 const source=fs.readFileSync(new URL('./where-autoindex-baseline.mjs',import.meta.url),'utf8');
 const branches=[...source.matchAll(/if\(process\.env\.AUTO_REAL_CAPACITY==='1'[\s\S]*?(?=if\(process\.env|const columns=)/g)].map(m=>m[0]);
 assert.equal(branches.length,4);
 const branch=branches.find(s=>s.includes('native.capacityOrder'));
 assert.ok(branch.includes('await realByteCapacity('));
 assert.ok(branch.includes("!sql.includes('NOT INDEXED')"));
 for(const kind of ['pulldown','pulldown-dependent','pulldown-ipk','pulldown-ipk-dependent'])assert.ok(branch.includes("'"+kind+"'"));
 assert.ok(branch.includes('assert.equal(work.filterAdds,2)'));
 assert.ok(branch.includes('liveFilterBytes:20000'));
 assert.ok(source.includes('assert.equal(filters[1]<seeks[0],early)'));
 const helper=fs.readFileSync(new URL('./where-autoindex-real-capacity.mjs',import.meta.url),'utf8');
 for(const dimension of ['maxPrivateBytes','maxPrivateEntries','maxPrivateKeyBytes'])assert.ok(helper.includes(dimension));
 assert.ok(helper.includes('for(const cap of [H-1,H,H+1])'));
 const capture=fs.readFileSync(new URL('./where-autoindex-capture.py',import.meta.url),'utf8');
 assert.ok(capture.includes("ORDER BY l.id+r.id,t.id,l.id,r.id"));
});
