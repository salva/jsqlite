import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {lowerOrdinaryCtes} from '../../src/internal/cte.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {compileTableSelect,programOpcodeNames} from '../../src/internal/vdbe.ts';

const here=path.dirname(new URL(import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');

test('ordinary CTE hints select the production coroutine/materialization routes',()=>{
  const storage=ImmutableStorage.open(fs.readFileSync(path.join(generated,'subquery-utf8.db')));
  const owner={[storageOwner]:storage};
  const opcodes=sql=>{
    const parsed=parseSql(sql);assert.equal(parsed.statement?.kind,'select');
    const lowered=lowerOrdinaryCtes(parsed.statement);assert.ok(lowered);
    return programOpcodeNames(compileTableSelect(lowered,loadSchemaGraph(owner),btreeFromStorage(storage),100));
  };
  try{
    const unhinted=opcodes('WITH q(x) AS (VALUES(8)) SELECT x FROM q');
    assert.ok(unhinted.includes('InitCoroutine'),'eligible one-use unhinted CTE takes tag-select-0482');
    assert.ok(!unhinted.includes('OpenEphemeral'),'eligible one-use unhinted CTE is not materialized');

    const repeatedUnhinted=opcodes('WITH q(x) AS (VALUES(8)) SELECT a.x FROM q AS a JOIN q AS b ON a.x=b.x');
    assert.equal(repeatedUnhinted.filter(op=>op==='OpenEphemeral').length,1,'repeated unhinted CTE is filled once');
    assert.equal(repeatedUnhinted.filter(op=>op==='OpenDup').length,1,'repeated unhinted CTE reuses its fill through OpenDup');
    assert.ok(!repeatedUnhinted.includes('InitCoroutine'),'repeated unhinted use disables the coroutine route');

    const eligible=opcodes('WITH q(x) AS NOT MATERIALIZED (VALUES(8)) SELECT x FROM q');
    assert.ok(eligible.includes('InitCoroutine'),'NOT MATERIALIZED permits tag-select-0482');
    assert.ok(!eligible.includes('OpenEphemeral'),'eligible coroutine is not materialized');

    const forced=opcodes('WITH q(x) AS MATERIALIZED (VALUES(8)) SELECT x FROM q');
    assert.ok(!forced.includes('InitCoroutine'),'M10d_Yes prevents tag-select-0482');
    assert.ok(forced.includes('OpenEphemeral'),'MATERIALIZED uses statement-private storage');
    assert.ok(forced.includes('IdxInsert'),'MATERIALIZED fills the private cursor');

    const repeatedHint=opcodes('WITH q(x) AS NOT MATERIALIZED (VALUES(8)) SELECT x FROM q UNION ALL SELECT x FROM q');
    assert.equal(repeatedHint.filter(op=>op==='InitCoroutine').length,2,'M10d_No permits each repeated arm to remain a coroutine');
    assert.ok(!repeatedHint.includes('OpenEphemeral'),'M10d_No overrides the repeated-use materialization heuristic when no other coroutine condition prevents it');
    assert.ok(!repeatedHint.includes('OpenDup'),'non-materialized repeated uses have independent coroutine state');
  }finally{storage.close();}
});
