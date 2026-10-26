#!/usr/bin/env python3
"""Pinned native short-record DEFAULT fixture and public typed/reset expectations."""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('planner',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 fn=getattr(d,'sqlite3_column_'+name);fn.argtypes=[C.c_void_p,C.c_int];fn.restype=C.c_char_p
out={'source':manifest,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 fixture=ROOT/f'test/conformance/fixtures/column-default-{enc.lower()}.db'
 assert not fixture.exists()
 db=C.c_void_p();assert d.sqlite3_open(str(fixture).encode(),C.byref(db))==m.OK
 setup=[f"PRAGMA encoding='{enc}'",'CREATE TABLE t(id INTEGER PRIMARY KEY,base TEXT)','INSERT INTO t VALUES(1,\'old\')',
 "ALTER TABLE t ADD COLUMN tx TEXT DEFAULT 'ténant'","ALTER TABLE t ADD COLUMN nu NUMERIC DEFAULT '12.0'",
 "ALTER TABLE t ADD COLUMN re REAL DEFAULT 7","ALTER TABLE t ADD COLUMN bl BLOB DEFAULT x'00ff'",
 'ALTER TABLE t ADD COLUMN ni INTEGER DEFAULT -9223372036854775808','ALTER TABLE t ADD COLUMN zz DEFAULT NULL',
 "ALTER TABLE t ADD COLUMN nt TEXT DEFAULT 1.25","ALTER TABLE t ADD COLUMN bo DEFAULT TRUE",
 'INSERT INTO t(id,base,tx,nu,re,bl,ni,zz,nt,bo) VALUES(2,\'null\',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)',
 "INSERT INTO t(id,base) VALUES(3,'new')",'CREATE INDEX ix ON t(tx,nu,re)']
 try:
  for sql in setup:m.execsql(d,db,sql)
 finally:assert d.sqlite3_close(db)==m.OK
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==m.OK
 queries=['SELECT id,tx,nu,re,bl,ni,zz,nt,bo FROM t NOT INDEXED ORDER BY id',
 'SELECT id,tx,nu,re FROM t INDEXED BY ix ORDER BY tx,id',
 'SELECT x.id,y.tx,y.re,y.bl FROM t x LEFT JOIN t y ON y.id=x.id+1 ORDER BY x.id',
 'SELECT x.id,y.tx,y.re FROM t x JOIN t y ON y.id=x.id ORDER BY x.id',
 'SELECT id,typeof(tx),typeof(nu),typeof(re),typeof(bl),typeof(ni),typeof(zz),typeof(nt),typeof(bo) FROM t ORDER BY id',
 'SELECT id,tx FROM t WHERE tx=\'ténant\' ORDER BY id',
 'SELECT count(tx),sum(nu),sum(re) FROM t']
 cases=[]
 try:
  for sql in queries:
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==m.OK,sql
   try:
    runs=[]
    for run in range(2):
     rows=[]
     while True:
      rc=d.sqlite3_step(st)
      if rc==m.ROW:rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
      else:assert rc==m.DONE;break
     runs.append(rows);assert d.sqlite3_reset(st)==m.OK
    assert runs[0]==runs[1]
    metadata=[]
    for i in range(d.sqlite3_column_count(st)):
     item={}
     for key,name in [('name','name'),('declaredType','decltype'),('databaseName','database_name'),('tableName','table_name'),('originName','origin_name')]:
      value=getattr(d,'sqlite3_column_'+name)(st,i);item[key]=value.decode() if value is not None else None
     metadata.append(item)
    cases.append({'sql':sql,'native':{'rows':runs[0],'metadata':metadata}})
   finally:assert d.sqlite3_finalize(st)==m.OK
 finally:assert d.sqlite3_close(db)==m.OK
 out['variants'].append({'encoding':enc,'fixture':str(fixture.relative_to(ROOT)),'sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'setup':setup,'cases':cases})
(ROOT/'test/conformance/cases/column-default-native.json').write_text(json.dumps(out,indent=2)+'\n')
print([(v['encoding'],v['sha256'],len(v['cases'])) for v in out['variants']])
