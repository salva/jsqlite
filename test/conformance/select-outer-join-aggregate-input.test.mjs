import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Original two native witnesses captured before repair; extra controls captured
// independently after first repair. SQLite source ID asserted by ctypes driver:
// 2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc
// select.c8884ff / wherecode.c2842ff: accumulator consumes the shared WHERE
// continuation, including unmatched completion, before single finalization.
const cases = [
  {
    "sql": "SELECT count(*),count(l.a),count(r.a),sum(r.a) FROM t1 l RIGHT JOIN t1 r ON l.a=r.a AND l.a<5",
    "names": [
      "count(*)",
      "count(l.a)",
      "count(r.a)",
      "sum(r.a)"
    ],
    "rows": [
      [
        4,
        2,
        4,
        16
      ]
    ]
  },
  {
    "sql": "SELECT count(*),count(l.a),count(r.a),sum(r.a) FROM t1 l RIGHT JOIN t1 r ON 0",
    "names": [
      "count(*)",
      "count(l.a)",
      "count(r.a)",
      "sum(r.a)"
    ],
    "rows": [
      [
        4,
        0,
        4,
        16
      ]
    ]
  },
  {
    "sql": "SELECT count(*),count(l.a),sum(r.a) FILTER (WHERE l.a IS NULL) FROM t1 l RIGHT JOIN t1 r ON l.a=r.a AND l.a<5 WHERE r.a>1",
    "names": [
      "count(*)",
      "count(l.a)",
      "sum(r.a) FILTER (WHERE l.a IS NULL)"
    ],
    "rows": [
      [
        3,
        1,
        12
      ]
    ]
  },
  {
    "sql": "SELECT count(*),count(DISTINCT r.a),sum(r.a) FROM t1 l FULL JOIN t1 r ON l.a=r.a AND l.a<5",
    "names": [
      "count(*)",
      "count(DISTINCT r.a)",
      "sum(r.a)"
    ],
    "rows": [
      [
        6,
        4,
        16
      ]
    ]
  },
  {
    "sql": "SELECT count(*),count(r.a),sum(l.a) FROM t1 l LEFT JOIN t1 r ON l.a=r.a AND l.a<5",
    "names": [
      "count(*)",
      "count(r.a)",
      "sum(l.a)"
    ],
    "rows": [
      [
        4,
        2,
        16
      ]
    ]
  },
  {
    "sql": "SELECT count(*) FROM t1 l RIGHT JOIN t1 r ON 0 LIMIT 1 OFFSET 1",
    "names": [
      "count(*)"
    ],
    "rows": []
  },
  {
    "sql": "SELECT count(*) FROM t1 l RIGHT JOIN t1 r ON l.a=r.a WHERE r.a<0",
    "names": [
      "count(*)"
    ],
    "rows": [
      [
        0
      ]
    ]
  },
  {
    "sql": "SELECT count(*),sum(r.a) FROM t1 l RIGHT JOIN t1 r ON 0 JOIN t1 x ON x.a=r.a",
    "names": [
      "count(*)",
      "sum(r.a)"
    ],
    "rows": [
      [
        4,
        16
      ]
    ]
  }
];
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
test('outer join aggregate input uses shared matched/unmatched continuation',async()=>{
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/right-aggregate');}finally{globalThis.fetch=original;}
 try{
  for(const c of cases){const s=db.prepare(c.sql).statement;
   try{assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),c.names);
    for(let cycle=0;cycle<2;cycle++){
     const rows=[];while(await s.step()==='row'){
      rows.push(Array.from({length:s.columnCount},(_,i)=>{assert.equal(s.columnType(i),'integer');return Number(s.column(i));}));
     }
     assert.deepEqual(rows,c.rows,c.sql);s.reset();
    }
   }finally{s.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT r.a,count(l.a) FROM t1 l RIGHT JOIN t1 r ON l.a=r.a AND l.a<5 GROUP BY r.a ORDER BY r.a'),e=>e.kind==='unsupported');
 }finally{db.close();}
});
