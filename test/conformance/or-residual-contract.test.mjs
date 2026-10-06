import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('current Case5 guide has one tested/untested residual contract',()=>{
 const s=fs.readFileSync(new URL('../../docs/TRANSLATION.md',import.meta.url),'utf8');
 assert.ok(!s.includes('Full arm/parent residuals\nremain tested (no TERM_CODED omission'),'superseded unconditional residual contract removed');
 assert.ok(s.includes('fully tested selected parents omit repeated common-body truth'));
 assert.ok(s.includes('unready arm terms retain their residual'));
});
