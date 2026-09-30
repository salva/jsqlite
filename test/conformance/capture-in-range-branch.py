#!/usr/bin/env python3
"""Pinned development-only builder and read-only oracle for the review-v6 branch matrix."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('planner',ROOT/'test/conformance/capture-index-planner.py'); m=importlib.util.module_from_spec(p);p.loader.exec_module(m)
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
d=m.load(sys.argv[1]);assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
fixture=ROOT/'test/conformance/fixtures/in-range-branch-utf8.db'
if '--build' in sys.argv:
 fixture.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(fixture).encode(),C.byref(db))==m.OK
 try:
  m.execsql(d,db,'CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER,d INTEGER)')
  m.execsql(d,db,'CREATE INDEX t_abcd ON t(a,b,c,d)')
  m.execsql(d,db,'INSERT INTO t VALUES (1,1,1,1,1),(2,1,2,1,2),(3,2,2,2,2),(4,2,3,2,3),(5,3,3,3,3)')
 finally:d.sqlite3_close(db)
db=C.c_void_p();assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==m.OK
cases=[
 ('fourth-IN-slot','selected','SELECT id FROM t INDEXED BY t_abcd WHERE a IN (2,1) AND b IN (3,2,1) AND c IN (2,1) AND d IN (3,2,1) ORDER BY id'),
 ('equality-range-alternative','selected','SELECT id FROM t INDEXED BY t_abcd WHERE a IN (1,2) AND a>=1 AND a<3 AND b>=2 AND b<3 AND c>0 ORDER BY id'),
 ('subquery-IN-RHS','residual','SELECT id FROM t INDEXED BY t_abcd WHERE a IN (SELECT a FROM t WHERE id=3) AND b>=2 ORDER BY id'),
 ('forced-index-traversal','residual','SELECT id FROM t INDEXED BY t_abcd WHERE d>=2 ORDER BY id'),
 ('multi-source-prerequisite','selected','SELECT x.id,y.id FROM t x JOIN t y INDEXED BY t_abcd ON y.a IN (x.a) AND y.b=2 WHERE x.id IN (1,3) ORDER BY x.id,y.id'),
 ('selected-versus-residual','residual','SELECT id FROM t NOT INDEXED WHERE a IN (1,2) AND b>=2 ORDER BY id'),
 ('prepare-unsupported','unsupported','SELECT id FROM t INDEXED BY t_abcd WHERE (a,b) IN ((1,2),(2,2)) ORDER BY id'),
]
try:
 out=[]
 for dimension,disposition,sql in cases:
  if disposition=='unsupported':
   # The pinned source accepts vector IN; TS explicitly does not.
   rows,counters=m.query(d,db,sql);eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  else:
   rows,counters=m.query(d,db,sql);eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  out.append(dict(dimension=dimension,disposition=disposition,sql=sql,fixture=str(fixture.relative_to(ROOT)),expected=rows,eqp=eqp,nativeCounters=counters))
finally:d.sqlite3_close(db)
result=dict(sourceId=manifest['sqliteSourceId'],fixtureSha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),cases=out)
(ROOT/'test/conformance/cases/in-range-branch-applicability.json').write_text(json.dumps(result,indent=2)+'\n')
