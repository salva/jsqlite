#!/usr/bin/env python3
"""Pinned-native FIRST prefix earlyout fixture; no ANALYZE/SeekScan branch."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
lib,directory=sys.argv[1:];out=pathlib.Path(directory);out.mkdir(parents=True,exist_ok=True)
d=m.load(lib);manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
assert d.sqlite3_libversion().decode()==manifest['version']
cases={
 'list-absent':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN(1,2,3)',[]),
 'list-present':('SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b IN(1,2,3,2,NULL)',[]),
 'list-null':('SELECT id FROM t INDEXED BY t_ab WHERE a=?1 AND b IN(1,2,3)',[None]),
 'list-empty':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN()',[]),
 'list-left-null':('SELECT x.v,y.id FROM rhs x LEFT JOIN t y INDEXED BY t_ab ON y.a=?1 AND y.b IN(1,2,3)',[None]),
 'list-null-rhs':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN(NULL,NULL)',[]),
 'list-joined':('SELECT x.id,y.id FROM t x INDEXED BY t_ab JOIN t y ON y.id=x.id WHERE x.a=999 AND x.b IN(1,2,3)',[]),
 'list-left':('SELECT x.v,y.id FROM rhs x LEFT JOIN t y INDEXED BY t_ab ON y.a=999 AND y.b IN(1,2,3)',[]),
 'list-reverse':('SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b IN(1,2,3) ORDER BY a DESC,b DESC',[]),
 'list-two-slot':('SELECT id FROM t INDEXED BY t_ab WHERE a IN(1,2,3) AND b IN(1,2,3)',[]),
 'list-mixed':('SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs) AND b IN(1,2,3)',[]),
 'absent':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN(SELECT v FROM rhs)',[]),
 'present':('SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b IN(SELECT v FROM rhs)',[]),
 'null':('SELECT id FROM t INDEXED BY t_ab WHERE a=?1 AND b IN(SELECT v FROM rhs)',[None]),
 'empty':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN(SELECT v FROM rhs WHERE 0)',[]),
 'null-rhs':('SELECT id FROM t INDEXED BY t_ab WHERE a=999 AND b IN(SELECT NULL FROM rhs)',[]),
 'joined':('SELECT x.id,y.id FROM t x INDEXED BY t_ab JOIN t y ON y.id=x.id WHERE x.a=999 AND x.b IN(SELECT v FROM rhs)',[]),
 'left':('SELECT x.v,y.id FROM rhs x LEFT JOIN t y INDEXED BY t_ab ON y.a=999 AND y.b IN(SELECT v FROM rhs)',[]),
 'reverse':('SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b IN(SELECT v FROM rhs) ORDER BY a DESC,b DESC',[]),
 'two-slot':('SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs) AND b IN(SELECT v FROM rhs)',[]),
}
variants=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 p=out/(encoding+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 try:
  for sql in [f"PRAGMA encoding='{encoding}'",'CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b REAL)','CREATE INDEX t_ab ON t(a,b)','CREATE TABLE rhs(v)','INSERT INTO rhs VALUES(1),(2),(3),(NULL),(2)', 'INSERT INTO t VALUES(1,1,1),(2,1,3),(3,4,2)']:m.execsql(d,db,sql)
 finally:d.sqlite3_close(db)
 assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==0
 captured={}
 try:
  for name,(sql,params) in cases.items():
   rows,work=m.query(d,db,sql,params);ops,_=m.query(d,db,'EXPLAIN '+sql,params)
   program=[{'addr':int(r[0]['value']),'opcode':m.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value']),'p4':None if r[5]['type']=='null' else m.text(r[5])} for r in ops]
   captured[name]={'sql':sql,'bindings':params,'rows':rows,'program':program,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,params),'work':work}
  assert any(op['opcode']=='IfNoHope' for op in captured['absent']['program'])
 finally:d.sqlite3_close(db)
 variants.append({'encoding':encoding,'fixture':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':captured})
(out/'native.json').write_text(json.dumps({'sourceId':manifest['sqliteSourceId'],'variants':variants},indent=2)+'\n')
print('captured',len(cases),'cases x',len(variants),'encodings; SHA256',hashlib.sha256((out/'native.json').read_bytes()).hexdigest())
