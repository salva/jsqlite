import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// This is an ownership acceptance check, not a claim of behavioral parity.
// A standalone SelectDest type or finished-Program wrapper does not pass: each
// listed producer must actually consume the same builder/destination contract.
const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
const producers=['compileScalarSelect','compileTableSelect','compileAggregateSelect','compileRecursiveCteSelect'];
test('SELECT producers consume a shared destination/program construction contract',()=>{
 const start=text.indexOf('export function compileScalarSelect(');
 assert.ok(start>=0,'scalar producer exists');
 for(const name of producers){
  const at=text.indexOf(`export function ${name}(`);
  assert.ok(at>=0,`${name} exists`);
  const next=text.indexOf('\nexport function ',at+1);
  const body=text.slice(at,next<0?text.length:next);
  assert.match(body,/SelectProgramBuilder|selectProgramBuilder|emitSelectDestination/,`${name} must consume the shared contract, not only return a finished Program`);
 }
});
