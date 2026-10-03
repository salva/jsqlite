import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Source-owned contract: select.c sqlite3Select(7590ff) gets the enclosing
// Parse Vdbe and SelectDest; selectInnerLoop(1140ff) allocates iSdst from
// Parse.nMem. vdbeaux.c MakeReady(2647ff) consumes that same Parse frontier.
// This is an ownership acceptance check, not native SQL compatibility evidence.
const compiler = fs.readFileSync(new URL('../../src/internal/select-compiler.ts', import.meta.url), 'utf8');
const vdbe = fs.readFileSync(new URL('../../src/internal/vdbe.ts', import.meta.url), 'utf8');

test('ordinary physical SELECT entry forwards enclosing construction state', () => {
  const branch = compiler.match(/if \(select\.from\.items\.length \|\| select\.where\) \{([\s\S]*?)\n  \}/);
  assert.ok(branch, 'ordinary physical entry branch remains identifiable');
  assert.match(branch[1], /compileTableSelect\([^;]*privateStateLimits,\s*\{[^}]*builder[^}]*parameters[^}]*destination/s,
    'ordinary physical entry still calls standalone preparation instead of forwarding enclosing builder/parameters/destination');
});

test('ordinary physical producer consumes destination and allocation owner without local publication', () => {
  const first = vdbe.indexOf('  const scalarPlans=new Map<SelectNode,ReturnType<typeof expandAndResolveSelect>>();', vdbe.indexOf('export function compileTableSelect('));
  const end = vdbe.indexOf('\nfunction sameExpression(', first);
  assert.ok(first >= 0 && end > first, 'ordinary physical producer boundary');
  const ordinary = vdbe.slice(first, end);
  assert.doesNotMatch(ordinary, /const builder=new SelectProgramBuilder<Op>\(\)/,
    'ordinary physical producer still replaces enclosing builder');
  assert.doesNotMatch(ordinary, /emitSelectDestination\(ops,\{kind:"output"\}/,
    'scan and sorter drain must consume caller destination');
  assert.doesNotMatch(ordinary, /builder\.finish\(\)|ops\.push\(\{code:"Halt"\}\)/,
    'producer must leave final publication to enclosing entry');
});

// Independently captured from pinned source-ID-asserted library BEFORE migration.
// Ordinary scan/sorter/DISTINCT/IPK and nested singleton consumers share state.
const nativeCases = [{"sql": "SELECT a,b FROM t1 ORDER BY a", "rows": [[["integer", "1"], ["integer", "2"]], [["integer", "3"], ["integer", "4"]], [["integer", "5"], ["integer", "6"]], [["integer", "7"], ["integer", "8"]]], "names": ["a", "b"], "error": null}, {"sql": "SELECT rowid,a,b FROM t1 WHERE rowid>=2 ORDER BY rowid DESC LIMIT 2 OFFSET 1", "rows": [[["integer", "5"], ["integer", "5"], ["integer", "6"]], [["integer", "3"], ["integer", "3"], ["integer", "4"]]], "names": ["a", "a", "b"], "error": null}, {"sql": "SELECT DISTINCT a%3 AS k FROM t1 ORDER BY k DESC", "rows": [[["integer", "2"]], [["integer", "1"]], [["integer", "0"]]], "names": ["k"], "error": null}, {"sql": "SELECT a,(SELECT (SELECT t.a)) FROM t1 t ORDER BY a", "rows": [[["integer", "1"], ["integer", "1"]], [["integer", "3"], ["integer", "3"]], [["integer", "5"], ["integer", "5"]], [["integer", "7"], ["integer", "7"]]], "names": ["a", "(SELECT (SELECT t.a))"], "error": null}, {"sql": "SELECT a,1.5,NULL FROM t1 WHERE a>3 ORDER BY a DESC LIMIT 2", "rows": [[["integer", "7"], ["real", 1.5], ["null", null]], [["integer", "5"], ["real", 1.5], ["null", null]]], "names": ["a", "1.5", "NULL"], "error": null}, {"sql": "SELECT a FROM t1 WHERE a<0", "rows": [], "names": ["a"], "error": null}, {"sql": "SELECT a FROM t1 ORDER BY a LIMIT 0", "rows": [], "names": ["a"], "error": null}];
import {open} from '../../src/index.ts';
test('ordinary physical shared entry preserves native rows types names and lifecycle', async () => {
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try {globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/ordinary-entry');} finally {globalThis.fetch=old;}
 try {for(const c of nativeCases){const statement=db.prepare(c.sql).statement;
  try {// Existing IPK alias naming divergence: public rowid vs native declared a.
   // Keep visible as a gap; this migration changes construction, not naming.
   assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),c.sql.startsWith('SELECT rowid,')?['rowid','a','b']:c.names);
   for(let pass=0;pass<2;pass++){const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),typeof statement.column(i)==='bigint'?String(statement.column(i)):statement.column(i)]));
    assert.deepEqual(rows,c.rows,c.sql);assert.equal(await statement.step(),'done');if(pass===0)statement.reset();}
  } finally {statement.finalize();}
 }} finally {db.close();}
});
