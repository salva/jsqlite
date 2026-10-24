#!/usr/bin/env python3
"""Independent pinned public-API receipt for actual standalone reprepare."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('n',ROOT/'test/conformance/capture-index-planner.py')
n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(sys.argv[1]);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
d.sqlite3_stmt_status.argtypes=[C.c_void_p,C.c_int,C.c_int];d.sqlite3_stmt_status.restype=C.c_int
sql="SELECT x.id,y.id FROM t x CROSS JOIN tiny z CROSS JOIN t y WHERE y.a=?1 AND y.b=x.b AND y.s='cold' ORDER BY x.id,y.id"
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 fixture=ROOT/'docs/research/card-s-h'/f'{enc}.db';db=C.c_void_p()
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
 st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 columns=[]
 for i in range(2):
  metadata={}
  for key,fn in [('name','sqlite3_column_name'),('declaredType','sqlite3_column_decltype'),('database','sqlite3_column_database_name'),('table','sqlite3_column_table_name'),('origin','sqlite3_column_origin_name')]:
   f=getattr(d,fn);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
   v=f(st,i);metadata[key]=v.decode() if v else None
  columns.append(metadata)
 runs=[]
 for value in [99,98]:
  n.bind(d,st,[value]);rows=[]
  while (rc:=d.sqlite3_step(st))==100:rows.append([n.cell(d,st,i) for i in range(2)])
  assert rc==101
  eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[value]);assert any('BLOOM FILTER' in p for p in eqp)
  reprepare=d.sqlite3_stmt_status(st,5,1);assert reprepare>0
  runs.append({'binding':value,'rows':rows,'eqp':eqp,'reprepare':reprepare})
  assert d.sqlite3_reset(st)==0
 assert d.sqlite3_finalize(st)==0;assert d.sqlite3_close(db)==0
 variants.append({'encoding':enc,'fixture':str(fixture),'sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'columns':columns,'runs':runs})
pathlib.Path(sys.argv[2]).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'sql':sql,'variants':variants},indent=2)+'\n')
print('captured three encodings; two sensitive standalone bindings each')
