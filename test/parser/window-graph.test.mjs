import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSql} from '../../src/internal/parse.ts';

const definition = (exclude) => {
  const statement = parseSql(
    `SELECT sum(a) OVER w FROM t1 WINDOW w AS (` +
    `ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE ${exclude})`,
  ).statement;
  assert.equal(statement?.kind, 'select');
  return statement.windowDefinitions[0];
};

test('generated window semantics retain the EXCLUDE mode in the owned graph', () => {
  const ties = definition('TIES');
  const group = definition('GROUP');
  assert.ok(ties);
  assert.ok(group);
  assert.notDeepEqual(
    ties,
    group,
    'parse.y frame semantics must not collapse EXCLUDE TIES and EXCLUDE GROUP',
  );
});

import {expandAndResolveSelect, NameResolutionError} from '../../src/internal/resolve.ts';
const column = (name) => Object.freeze({name, declaredType:'INTEGER', affinity:'integer', collation:null});
const table = Object.freeze({kind:'table', name:'t1', tableName:'t1', rootPage:2, sql:'', columns:Object.freeze([column('a'),column('b')]), indexes:Object.freeze([]), withoutRowid:false, primaryKey:Object.freeze([]), storageKey:Object.freeze([])});
const schema = {tables:new Map([['t1',table]])};
const resolve = (sql) => expandAndResolveSelect(parseSql(sql).statement, schema);

test('window chain copies earlier definitions and links compatible functions', () => {
  const resolved=resolve('SELECT sum(a) OVER w2, avg(a) OVER w2 FROM t1 WINDOW w AS (PARTITION BY b ORDER BY a), w2 AS (w ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES)');
  assert.equal(resolved.windowDefinitions[1].partitionBy[0].tokens[0].text,'b');
  assert.equal(resolved.windowDefinitions[1].orderBy[0].tokens[0].text,'a');
  assert.deepEqual(resolved.windows.map(window=>window.compatibleGroup),[0,0]);
  assert.equal(resolved.windows[0].frame.exclusion,'ties');
  assert.ok(Object.isFrozen(resolved.windows)&&Object.isFrozen(resolved.windows[0]));
});

test('window update coerces built-ins and preserves distinct nesting groups', () => {
  const resolved=resolve('SELECT row_number() OVER (ORDER BY a ROWS CURRENT ROW EXCLUDE TIES), sum(a) OVER (PARTITION BY b ORDER BY a) FROM t1');
  assert.deepEqual(resolved.windows[0].frame,{type:'rows',start:{kind:'unbounded',expr:null},end:{kind:'current',expr:null},exclusion:null,implicit:false});
  assert.deepEqual(resolved.windows.map(window=>window.compatibleGroup),[0,1]);
  assert.equal(resolved.multipleWindowPartitions,true);
});

test('window chain and update retain source diagnostics', () => {
  const cases=[
    ['SELECT sum(a) OVER z FROM t1','no such window: z'],
    ['SELECT sum(a) OVER w2 FROM t1 WINDOW w2 AS (missing)','no such window: missing'],
    ['SELECT sum(a) OVER w2 FROM t1 WINDOW w AS (ORDER BY a), w2 AS (w PARTITION BY b)','cannot override PARTITION clause of window: w'],
    ['SELECT sum(a) OVER w2 FROM t1 WINDOW w AS (ORDER BY a), w2 AS (w ORDER BY b)','cannot override ORDER BY clause of window: w'],
    ['SELECT sum(a) OVER w2 FROM t1 WINDOW w AS (ROWS CURRENT ROW), w2 AS (w)','cannot override frame specification of window: w'],
    ['SELECT row_number(1) OVER () FROM t1','wrong number of arguments to function row_number()'],
    ['SELECT row_number() FILTER (WHERE a) OVER () FROM t1','FILTER clause may only be used with aggregate window functions'],
    ['SELECT sum(a) OVER (RANGE 1 PRECEDING) FROM t1','RANGE with offset PRECEDING/FOLLOWING requires one ORDER BY expression'],
  ];
  for(const [sql,message] of cases)assert.throws(()=>resolve(sql),error=>error instanceof NameResolutionError&&error.message===message,sql);
});

test('frame allocation canonicalizes explicit zero offsets to CURRENT ROW',()=>{
  const parsed=parseSql('SELECT sum(a) OVER w FROM t1 WINDOW w AS (ORDER BY a ROWS BETWEEN 0 PRECEDING AND 0 FOLLOWING)').statement;
  assert.deepEqual(parsed.windowDefinitions[0].frame.start,{kind:'current',expr:null});
  assert.deepEqual(parsed.windowDefinitions[0].frame.end,{kind:'current',expr:null});
});
