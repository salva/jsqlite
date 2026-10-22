#!/usr/bin/env python3
"""Pinned native covered-column substitution and deferred table-read controls."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'))
o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
d=o.load(args.library);pin=json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];assert d.sqlite3_libversion().decode()==pin['version']
root=pathlib.Path(args.output);root.mkdir(parents=True,exist_ok=True);variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 o.execsql(d,db,"PRAGMA encoding='%s'"%enc)
 o.execsql(d,db,'CREATE TABLE t(id INTEGER PRIMARY KEY,a,b);CREATE INDEX i_a ON t(a);INSERT INTO t VALUES(1,1,-9223372036854775808),(2,2,-9223372036854775808);')
 assert d.sqlite3_close(db)==0
 raw=bytearray(p.read_bytes());page=int.from_bytes(raw[16:18],'big');page=65536 if page==1 else page;raw[page]=0
 corrupt=root/(enc+'-corrupt.db');corrupt.write_bytes(raw)
 for file in [p,corrupt]:
  assert d.sqlite3_open_v2(str(file).encode(),C.byref(db),1,None)==0
  cases=[]
  for name,condition in [('false','abs(o.b)=1 AND o.a+0<0'),('reverse','o.a+0<0 AND abs(o.b)=1'),('rowid','abs(o.b)=1 AND o.id+0<0'),('uncovered','abs(o.b)=1 AND o.a+0>0')]:
   q='SELECT o.a,u.id FROM t o INDEXED BY i_a CROSS JOIN t u NOT INDEXED WHERE '+condition
   ops,_=o.query(d,db,'EXPLAIN '+q)
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None)==0
   expected=(11 if file==corrupt else 1) if name=='uncovered' else 101
   for run in range(2):
    rc=d.sqlite3_step(st);assert rc==expected,(enc,name,rc,expected)
    assert d.sqlite3_reset(st)==(0 if rc==101 else rc)
   assert d.sqlite3_finalize(st)==0
   cases.append(dict(name=name,sql=q,rc=expected,ops=ops))
  q='SELECT o.a,o.id,o.rowid FROM t o INDEXED BY i_a CROSS JOIN t u NOT INDEXED WHERE o.a+0>0 AND u.id=1'
  rows,_=o.query(d,db,q) if file==p else (None,None)
  if rows is not None:cases.append(dict(name='rows',sql=q,rows=rows))
  assert d.sqlite3_close(db)==0
  variants.append(dict(encoding=enc,fixture=file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),corrupt=file==corrupt,cases=cases))
(root/'native.json').write_text(json.dumps(dict(sourceid=pin['sqliteSourceId'],version=pin['version'],variants=variants)))
