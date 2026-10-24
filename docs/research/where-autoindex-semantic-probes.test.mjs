// Retains the accepted red's positive controls while requiring its missing boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('pulled IPK and indexed affinity use heterogeneous live probes and continuation checks',()=>{
 const capture=fs.readFileSync(new URL('./where-autoindex-capture.py',import.meta.url),'utf8');
 const consumer=fs.readFileSync(new URL('./where-autoindex-baseline.mjs',import.meta.url),'utf8');
 assert.ok(capture.includes("if ipk:"));
 for(const value of ['2.0','2.5',"'bad'","x'32'",'NULL','80002'])assert.ok(capture.includes(value));
 assert.ok(capture.includes("--semantic-probes"));
 assert.ok(capture.includes('ALTER TABLE lhs ADD COLUMN p;'));
 assert.ok(capture.includes("ops[guard][3]==ops[later][3]"));
 assert.ok(consumer.includes("assert.equal(filters.length,2)"));
 assert.ok(consumer.includes('if(native.semanticProbes)'));
 assert.ok(consumer.includes("names.lastIndexOf('Affinity',filters[1])"));
 assert.ok(consumer.includes("targets.find(t=>t.code==='MustBeInt').target,later.target"));
});
