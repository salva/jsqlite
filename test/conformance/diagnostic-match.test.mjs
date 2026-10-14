import test from 'node:test';
import assert from 'node:assert/strict';
import {matchDiagnostic} from './diagnostic-match.mjs';
test('missing current expectation fails without credit or dereference',()=>{
 for(const failure of [null,{op:'prepare',error:{name:'JSQLiteError',kind:'unsupported'}}])
  assert.deepEqual(matchDiagnostic({expected:{disposition:'unimplemented-temporary'}},failure),{matched:false,reason:'missing-diagnostic-expectation'});
});
test('exact current error matching rejects changed phase/type/code/message',()=>{
 const error={name:'JSQLiteError',kind:'sqlite',code:1,extendedCode:1,message:'no such column: a'};
 const c={diagnosticExpected:{disposition:'observed-error',error:{operation:'prepare',...error}}};
 assert.equal(matchDiagnostic(c,{op:'prepare',error}).matched,true);
 for(const k of ['name','kind','code','extendedCode','message'])assert.equal(matchDiagnostic(c,{op:'prepare',error:{...error,[k]:'different'}}).matched,false);
 assert.equal(matchDiagnostic(c,{op:'step',error}).matched,false);
 assert.equal(matchDiagnostic(c,null).matched,false);
});
test('completion requires explicit current disposition, not historic unsupported',()=>{
 assert.equal(matchDiagnostic({diagnosticExpected:{disposition:'completed'}},null).matched,true);
 assert.equal(matchDiagnostic({diagnosticExpected:{disposition:'completed'}},{op:'prepare',error:{name:'JSQLiteError',kind:'unsupported'}}).matched,false);
});
