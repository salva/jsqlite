#!/usr/bin/env python3
"""Pinned native selected/off-path corruption from an explicit SELECT-IN capture."""
import ctypes as C, importlib.util, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('oracle',root/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
lib,source,destination=sys.argv[1:]
d=m.load(lib);source=pathlib.Path(source);out=pathlib.Path(destination);out.mkdir(parents=True,exist_ok=True)
capture=json.loads((source/'native.json').read_text())
assert d.sqlite3_sourceid().decode()==capture['sourceId']==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
variants=[]
for v in capture['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(source/v['fixture']).encode(),C.byref(db),1,None)==0
 roots,_=m.query(d,db,"SELECT rootpage FROM sqlite_schema WHERE name='t_ab'")
 page=int(roots[0][0]['value']);d.sqlite3_close(db)
 raw=bytearray((source/v['fixture']).read_bytes());size=int.from_bytes(raw[16:18],'big');size=65536 if size==1 else size
 raw[(page-1)*size]=0
 target=out/v['fixture'];target.write_bytes(raw)
 assert d.sqlite3_open_v2(str(target).encode(),C.byref(db),1,None)==0
 try:
  rows,_=m.query(d,db,v['cases']['scan']['sql'])
  assert rows==v['cases']['scan']['rows']
  sql=v['cases']['forced']['sql'];st=C.c_void_p()
  assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  rc=d.sqlite3_step(st)
  assert rc==11,rc
  assert d.sqlite3_reset(st)==11
  assert d.sqlite3_step(st)==11
  assert d.sqlite3_finalize(st)==11
  variants.append({'encoding':v['encoding'],'fixture':v['fixture'],'rootpage':page,'selectedSql':sql,'scanSql':v['cases']['scan']['sql'],'rows':rows,'code':rc})
 finally:d.sqlite3_close(db)
(out/'native.json').write_text(json.dumps({'sourceId':capture['sourceId'],'variants':variants},indent=2)+'\n')
