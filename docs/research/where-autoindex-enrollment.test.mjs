// Enrollment regression only; actual SQL/fault evidence is linked from card status.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./where-autoindex-baseline.mjs',import.meta.url),'utf8');
test('original consumer enrolls INNER actual fault and progressed-interruption schedules',()=>{
 for(const [flag,callee] of [['AUTO_REAL_RECORD_FAULT','realRecordFault'],['AUTO_REAL_PAGE_FAULT','realPageFault'],['AUTO_REAL_CORRUPTION','realCorruption'],['AUTO_REAL_PROGRESS','realProgressInterrupt']]){
  const start=source.indexOf("if(process.env."+flag+"==='1'"),branch=source.slice(start,source.indexOf(';',start));
  assert.ok(start>=0);assert.ok(branch.includes('await '+callee+'('));
  for(const kind of ['inner','original'])assert.ok(branch.includes("'"+kind+"'"),flag+' must enroll '+kind);
  assert.ok(branch.includes("!sql.includes('NOT INDEXED')"));
 }
});
