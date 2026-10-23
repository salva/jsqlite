#!/usr/bin/env python3
"""Bounded development witness, not a runtime backend or complete beta.5 suite.
Run: python3 docs/research/where-autoindex-capture.py --library LIB --output DIR
Uses the existing typed native harness; databases and receipt remain in work storage.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
d=h.load(a.library)
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
sql='SELECT l.id AS lid,r.id AS rid,r.payload FROM lhs l LEFT JOIN rhs r ON r.k=l.k ORDER BY l.id,r.id'
result={'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(a.library).read_bytes()).hexdigest(),'sql':sql,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(enc+'.db');assert not path.exists(),path
 db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 h.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE lhs(id INTEGER PRIMARY KEY,k INTEGER); CREATE TABLE rhs(id INTEGER PRIMARY KEY,k INTEGER,payload TEXT);")
 h.execsql(d,db,'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<64) INSERT INTO lhs SELECT x,CASE WHEN x=64 THEN NULL ELSE x%16 END FROM n;')
 h.execsql(d,db,"WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<128) INSERT INTO rhs SELECT x,CASE WHEN x=128 THEN NULL ELSE x%16 END,'v'||x FROM n;")
 assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 variant={'encoding':enc,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'modes':[]}
 for enabled in [True,False]:
  h.execsql(d,db,'PRAGMA automatic_index='+('ON' if enabled else 'OFF'))
  eqp,_=h.query(d,db,'EXPLAIN QUERY PLAN '+sql);ops,_=h.query(d,db,'EXPLAIN '+sql)
  names=[h.text(row[1]) for row in ops]
  assert ('OpenAutoindex' in names)==enabled
  assert ('FilterAdd' in names)==enabled and ('Filter' in names)==enabled
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  columns=[{key:(getattr(d,'sqlite3_column_'+fn)(st,i) or b'').decode() or None for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]} for i in range(d.sqlite3_column_count(st))]
  runs=[]
  for run in range(2):
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([h.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   assert rc==101
   runs.append({'rows':rows,'rc':rc,'fullscanSteps':d.sqlite3_stmt_status(st,1,1),'autoindexRows':d.sqlite3_stmt_status(st,3,1),'vmSteps':d.sqlite3_stmt_status(st,4,1),'filterHit':d.sqlite3_stmt_status(st,8,1),'filterMiss':d.sqlite3_stmt_status(st,7,1)})
   assert d.sqlite3_reset(st)==0
  assert runs[0]==runs[1]
  assert d.sqlite3_finalize(st)==0
  variant['modes'].append({'automaticIndex':enabled,'columns':columns,'eqp':eqp,'ops':ops,'runs':runs})
 assert variant['modes'][0]['runs'][0]['rows']==variant['modes'][1]['runs'][0]['rows']
 assert d.sqlite3_close(db)==0
 result['variants'].append(variant)
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'receipt':str(out/'native.json'),'sha256':hashlib.sha256((out/'native.json').read_bytes()).hexdigest(),'variants':[{'encoding':v['encoding'],'modes':[{'enabled':m['automaticIndex'],'rows':len(m['runs'][0]['rows']),'scan':m['runs'][0]['fullscanSteps'],'build':m['runs'][0]['autoindexRows']} for m in v['modes']]} for v in result['variants']]},indent=2))
