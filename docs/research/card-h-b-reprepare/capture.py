#!/usr/bin/env python3
"""Pinned STAT4 public C API oracle. Never used by production."""
import ctypes as C, importlib.util, pathlib, json, sys, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(sys.argv[1]);assert d.sqlite3_sourceid().decode()==json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
d.sqlite3_stmt_status.argtypes=[C.c_void_p,C.c_int,C.c_int];d.sqlite3_stmt_status.restype=C.c_int
d.sqlite3_clear_bindings.argtypes=[C.c_void_p];d.sqlite3_clear_bindings.restype=C.c_int
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 fixture=ROOT/'docs/research/card-s-h'/f'{enc}.db';db=C.c_void_p();assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
 cases=[]
 for field,values in [('a',[99,0,98,99.0,None,'99',{'type':'blob','hex':'3939'}]),('s COLLATE nocase',['HOT','rare',None]),('s COLLATE rtrim',['hot ','rare',None]),('a',[0])]:
  sql=f'SELECT id,r,b FROM t WHERE {field}=? ORDER BY id';st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0;runs=[]
  for value in values:
   n.bind(d,st,[value]);rows=[]
   while (rc:=d.sqlite3_step(st))==100:rows.append([n.cell(d,st,i) for i in range(3)])
   assert rc==101;runs.append({'binding':value,'rows':rows,'eqp':n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[value]),'reprepare':d.sqlite3_stmt_status(st,5,1)})
   assert d.sqlite3_reset(st)==0
  assert d.sqlite3_clear_bindings(st)==0
  while (rc:=d.sqlite3_step(st))==100:pass
  assert rc==101;clear=d.sqlite3_stmt_status(st,5,1);assert d.sqlite3_finalize(st)==0
  cases.append({'sql':sql,'runs':runs,'clearReprepare':clear})
 masks=[]
 for slot in [1,31,32,33]:
  sql=f'SELECT ?34,id,r,b FROM t WHERE a=?{slot} ORDER BY id';st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  runs=[]
  for changed,value in [(slot,0),(34,8),(slot,99)]:
   assert d.sqlite3_reset(st)==0;assert d.sqlite3_bind_int64(st,changed,value)==0
   while (rc:=d.sqlite3_step(st))==100:pass
   assert rc==101;runs.append({'slot':changed,'value':value,'reprepare':d.sqlite3_stmt_status(st,5,1)})
  assert d.sqlite3_finalize(st)==0;masks.append({'sql':sql,'runs':runs})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':enc,'fixture':str(fixture.relative_to(ROOT)),'sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'cases':cases,'masks':masks})
pathlib.Path(__file__).with_name('native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':variants},indent=2)+'\n')
print('captured typed bindings/collations/clear and bound plans in three encodings')
