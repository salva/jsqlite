#!/usr/bin/env python3
"""Corrupt actual persistent RHS root, retaining independent native controls."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode=True
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('oracle',root/'test/conformance/capture-index-planner.py')
o=importlib.util.module_from_spec(s);s.loader.exec_module(o)
lib,source,destination=sys.argv[1:];source=pathlib.Path(source);out=pathlib.Path(destination);out.mkdir(parents=True,exist_ok=True)
d=o.load(lib);capture=json.loads((source/'native.json').read_text())
assert d.sqlite3_sourceid().decode()==capture['sourceid']==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
variants=[]
for v in capture['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(source/v['fixture']).encode(),C.byref(db),1,None)==0
 roots,_=o.query(d,db,"SELECT rootpage FROM sqlite_schema WHERE name='mixed_desc_v'")
 page=int(roots[0][0]['value']);assert d.sqlite3_close(db)==0
 selected=next(c for c in v['cases'] if c['name']=='mixed-desc')
 offsql='SELECT id,v,b FROM typed NOT INDEXED';
 assert d.sqlite3_open_v2(str(source/v['fixture']).encode(),C.byref(db),1,None)==0
 offrows,_=o.query(d,db,offsql);assert d.sqlite3_close(db)==0
 raw=bytearray((source/v['fixture']).read_bytes());size=int.from_bytes(raw[16:18],'big');size=65536 if size==1 else size
 assert page>1;raw[(page-1)*size]=0
 target=out/v['fixture'];target.write_bytes(raw)
 assert d.sqlite3_open_v2(str(target).encode(),C.byref(db),1,None)==0
 try:
  assert o.query(d,db,offsql)[0]==offrows
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,selected['sql'].encode(),-1,C.byref(st),None)==0
  codes=[d.sqlite3_step(st),d.sqlite3_reset(st),d.sqlite3_step(st),d.sqlite3_finalize(st)]
  assert codes==[11,11,11,11],codes
 finally:assert d.sqlite3_close(db)==0
 variants.append(dict(encoding=v['encoding'],fixture=target.name,sha256=hashlib.sha256(raw).hexdigest(),rhsRoot=page,selectedSql=selected['sql'],rows=selected['rows'],offSql=offsql,offRows=offrows,codes=codes))
(out/'native.json').write_text(json.dumps(dict(sourceid=capture['sourceid'],variants=variants),indent=2)+'\n')
print('captured physical RHS selected/offpath corruption',len(variants))
