// Production copy witness: does not modify the engine or replace copyFrom.
// Runs the accepted probe unchanged except for its isolated source-root locator.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const script=readFileSync(new URL('./card-r-d-lazy-column-probe.mjs',import.meta.url),'utf8');
const source=process.env.JSON_COLUMN_SOURCE??'lazy-column-red/source';
const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script.replace('lazy-column-red/source',source)],{encoding:'utf8',maxBuffer:16*1024*1024});
assert.equal(result.status,0,result.stderr);
const rows=result.stdout.trim().split('\n').map(line=>JSON.parse(line));
assert.equal(rows.length,120);
for(const row of rows){assert.equal(row.error,null,JSON.stringify(row));if(row.kind!=='explicit'){assert.equal(row.copies,1,JSON.stringify(row));assert.equal(row.blobs,0,JSON.stringify(row));}else if(row.binary){assert.ok(row.blobs>=row.rows,JSON.stringify(row));}else{assert.ok(row.copies>=row.rows+1,JSON.stringify(row));}}
console.log('120 runtime-demand copy witnesses passed (not total-allocation or complete typed parity evidence)');
