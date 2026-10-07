#!/usr/bin/env python3
"""Read-only joined/OR/IN companions; capture after dormant wiring, before repairs.
No earlier native-first chronology is inferred for these new cases.
"""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g/primitive-companions'
queries=[
 'SELECT a,b FROM t INDEXED BY ab WHERE b IN (7,NULL,8)',
 'SELECT a,b FROM t WHERE b=7 OR b=8',
 'SELECT a,b FROM t WHERE b=7 OR b>28',
 'SELECT x.a,x.b FROM t AS u CROSS JOIN t AS x WHERE u.rowid=1 AND (x.b=7 OR x.b>28)',
 'SELECT a,b FROM t WHERE b=7 OR b IS NULL',
 'SELECT x.a,x.b FROM t AS u CROSS JOIN t AS x WHERE u.rowid=1 AND (x.b=7 OR x.b IS NULL)',
 'SELECT x.a,x.b FROM t AS u CROSS JOIN t AS x INDEXED BY ab WHERE u.rowid=1 AND x.b=7',
 'SELECT x.a,x.b FROM t AS u CROSS JOIN t AS x INDEXED BY ab WHERE u.rowid=1 AND (x.b=7 OR x.b=8)',
 'SELECT x.a,x.b FROM t AS u LEFT JOIN t AS x INDEXED BY ab ON x.b=99 WHERE u.rowid=1',
 'SELECT x.a,x.b FROM t AS u CROSS JOIN t AS x INDEXED BY ab WHERE u.rowid=1 AND x.b IS NULL',
]
variants=[]
for v in json.loads((base/'native.json').read_text())['variants']:
 if v['tail']!='18':continue
 f=base/v['fixture'];assert hashlib.sha256(f.read_bytes()).hexdigest()==v['sha256']
 db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql in queries:
  rows,counters=n.query(d,db,sql);cases.append({'sql':sql,'rows':rows,'eqp':n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,()),'opcodes':n.explain(d,db,'EXPLAIN ',sql,()),'counters':counters})
 assert d.sqlite3_close(db)==0
 variants.append({**{k:v[k] for k in ['encoding','tail','fixture','sha256']},'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after dormant caller wiring; before subsequent case-driven runtime repairs','variants':variants},indent=2)+'\n')
print('PASS:30 independently captured read-only joined/OR/IN cases')
