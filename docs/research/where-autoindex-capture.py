#!/usr/bin/env python3
"""Bounded development witness, not a runtime backend or complete beta.5 suite.
Run: python3 docs/research/where-autoindex-capture.py --library LIB --output DIR
Uses the existing typed native harness; databases and receipt remain in work storage.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);p.add_argument('--case',default='original',choices=['original','absent','collision','inner','on','where','is','empty-inner','empty-outer','types','nocase','rtrim','binary','lifetime','representations','standalone']);a=p.parse_args()
out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
d=h.load(a.library)
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
sql='SELECT l.id AS lid,r.id AS rid,r.payload FROM lhs l LEFT JOIN rhs r ON r.k=l.k ORDER BY l.id,r.id'
if a.case=='inner': sql=sql.replace('LEFT JOIN','INNER JOIN')
if a.case=='on': sql=sql.replace('r.k=l.k','r.k=l.k AND r.id<4')
if a.case=='where': sql=sql.replace(' ORDER BY',' WHERE r.id<4 ORDER BY')
if a.case=='is': sql=sql.replace('r.k=l.k','r.k IS l.k')
if a.case=='lifetime': sql=sql.replace('r.k=l.k','r.k=?1')
if a.case in ['nocase','rtrim','binary']:
 sql=sql.replace('r.k=l.k',f'r.k=l.k AND r.payload=l.c COLLATE {a.case.upper()}')
if a.case=='representations': sql='SELECT l.id AS lid,r.id AS rid,l.k AS lk,r.k AS rk FROM lhs l LEFT JOIN rhs r ON r.k=l.k ORDER BY l.id,r.id'
if a.case=='standalone': sql="SELECT l.id AS lid,r.id AS rid,r.payload FROM lhs l CROSS JOIN rhs r WHERE r.k=l.k AND r.payload='v2' ORDER BY l.id,r.id"
result={'case':a.case,'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(a.library).read_bytes()).hexdigest(),'sql':sql,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(enc+'.db');assert not path.exists(),path
 db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 affinity='' if a.case=='representations' else 'INTEGER'
 h.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE lhs(id INTEGER PRIMARY KEY,k {affinity}); CREATE TABLE rhs(id INTEGER PRIMARY KEY,k {affinity},payload TEXT);")
 h.execsql(d,db,'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<64) INSERT INTO lhs SELECT x,CASE WHEN x=64 THEN NULL ELSE x%16 END FROM n;')
 h.execsql(d,db,"WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<128) INSERT INTO rhs SELECT x,CASE WHEN x=128 THEN NULL ELSE x%16 END,'v'||x FROM n;")
 if a.case in ['nocase','rtrim','binary']:
  h.execsql(d,db,"ALTER TABLE lhs ADD COLUMN c TEXT; UPDATE lhs SET c=CASE id%3 WHEN 0 THEN 'A'||char(0)||'x' WHEN 1 THEN 'a ' ELSE 'A' END; UPDATE rhs SET payload=CASE id%3 WHEN 0 THEN 'a'||char(0)||'y' WHEN 1 THEN 'a' ELSE 'A' END;")
 if a.case in ['absent','collision']:
  # Native filterHash numeric addition, 10000-byte filter: 80001 collides
  # with present key 1 modulo 80000; 17 has an absent bit. No host hash.
  h.execsql(d,db,f'UPDATE lhs SET k={17 if a.case=="absent" else 80001} WHERE id<64;')
 if a.case=='empty-inner': h.execsql(d,db,'DELETE FROM rhs;')
 if a.case=='empty-outer': h.execsql(d,db,'DELETE FROM lhs;')
 if a.case=='types':
  h.execsql(d,db,"UPDATE lhs SET k=CASE id%8 WHEN 0 THEN 1.0 WHEN 1 THEN 1.5 WHEN 2 THEN '01' WHEN 3 THEN 'x' WHEN 4 THEN x'31' WHEN 5 THEN -1 WHEN 6 THEN NULL ELSE 80001 END; UPDATE rhs SET k=CASE id%7 WHEN 0 THEN 1 WHEN 1 THEN 1.5 WHEN 2 THEN '01' WHEN 3 THEN 'X' WHEN 4 THEN x'31' WHEN 5 THEN -1 ELSE NULL END;")
 if a.case=='representations':
  # No declared affinity preserves REAL 1.0 in storage, unlike INTEGER.
  h.execsql(d,db,"UPDATE lhs SET k=CASE id%8 WHEN 0 THEN 1.0 WHEN 1 THEN 1 WHEN 2 THEN '1' WHEN 3 THEN x'31' WHEN 4 THEN -1.0 WHEN 5 THEN -1 WHEN 6 THEN NULL ELSE 17 END; UPDATE rhs SET k=CASE id%8 WHEN 0 THEN 1 WHEN 1 THEN 1.0 WHEN 2 THEN '1' WHEN 3 THEN x'31' WHEN 4 THEN -1 WHEN 5 THEN -1.0 WHEN 6 THEN NULL ELSE 80001 END;")
 if a.case=='standalone':
  h.execsql(d,db,"CREATE INDEX rk ON rhs(k); WITH RECURSIVE n(x) AS(VALUES(65) UNION ALL SELECT x+1 FROM n WHERE x<1024) INSERT INTO lhs SELECT x,x%32 FROM n; ANALYZE;")
 assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 variant={'encoding':enc,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'modes':[]}
 for enabled in [True,False]:
  h.execsql(d,db,'PRAGMA automatic_index='+('ON' if enabled else 'OFF'))
  if a.case=='standalone':
   # SQLITE_TESTCTRL_OPTIMIZATIONS=15; sqliteInt.h SQLITE_BloomFilter.
   d.sqlite3_test_control(15,db,0 if enabled else 0x00080000)
  eqp,_=h.query(d,db,'EXPLAIN QUERY PLAN '+sql);ops,_=h.query(d,db,'EXPLAIN '+sql)
  names=[h.text(row[1]) for row in ops]
  assert ('OpenAutoindex' in names)==(enabled and a.case!='standalone')
  if a.case=='standalone':
   assert 'SeekGE' in names
   assert any('USING INDEX rk' in h.text(row[3]) for row in eqp)
  if a.case!='is':
   assert ('FilterAdd' in names)==enabled and ('Filter' in names)==enabled
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  columns=[{key:(getattr(d,'sqlite3_column_'+fn)(st,i) or b'').decode() or None for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]} for i in range(d.sqlite3_column_count(st))]
  runs=[]
  # One prepared owner for reset/rebind; finalize then actually prepare again.
  bindings=[1,1,17,17,80001,80001] if a.case=='lifetime' else [None,None]
  for run,binding in enumerate(bindings):
   if a.case=='lifetime':
    if run==4:
     assert d.sqlite3_finalize(st)==0
     st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
     replacement_columns=[{key:(getattr(d,'sqlite3_column_'+fn)(st,i) or b'').decode() or None for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]} for i in range(d.sqlite3_column_count(st))]
     assert replacement_columns==columns
    h.bind(d,st,[binding])
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([h.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   assert rc==101
   runs.append({'rows':rows,'rc':rc,'fullscanSteps':d.sqlite3_stmt_status(st,1,1),'autoindexRows':d.sqlite3_stmt_status(st,3,1),'vmSteps':d.sqlite3_stmt_status(st,4,1),'filterHit':d.sqlite3_stmt_status(st,8,1),'filterMiss':d.sqlite3_stmt_status(st,7,1)})
   assert d.sqlite3_reset(st)==0
  for i in range(0,len(runs),2): assert runs[i]==runs[i+1]
  if a.case=='standalone':
   assert len(rows)==34
   assert runs[0]['autoindexRows']==0
   assert (runs[0]['filterHit'],runs[0]['filterMiss'])==((989,34) if enabled else (0,0))
  if a.case=='representations':
   assert len(rows)==1296
   assert any(row[2]['type']=='real' and row[3]['type']=='integer' for row in rows)
   assert any(row[2]['type']=='integer' and row[3]['type']=='real' for row in rows)
   assert all(row[1]['type']=='null' for row in rows if row[2]['type']=='null' or row[2].get('value')=='17')
   for row in rows:
    if row[2]['type'] in ['text','blob']: assert row[3]==row[2]
  if a.case=='lifetime':
   assert len(runs[0]['rows'])==512
   assert all(row[1]['type']=='integer' for row in runs[0]['rows'])
   for i in [2,4]:
    assert len(runs[i]['rows'])==64
    assert all(row[1]['type']=='null' for row in runs[i]['rows'])
   if enabled:
    # The RHS-only parameter equality becomes a native partial-build predicate:
    # neither missing key inserts records, so both have an empty Bloom filter.
    assert runs[0]['autoindexRows']==127
    assert (runs[2]['filterHit'],runs[2]['filterMiss'])==(64,0)
    assert (runs[4]['filterHit'],runs[4]['filterMiss'])==(64,0)
  if enabled and a.case in ['absent','collision']:
   assert len(rows)==64 and all(row[1]['type']=='null' for row in rows)
   assert runs[0]['filterHit']==(63 if a.case=='absent' else 0)
   assert runs[0]['filterMiss']==(0 if a.case=='absent' else 63)
  assert d.sqlite3_finalize(st)==0
  variant['modes'].append({'automaticIndex':enabled,'columns':columns,'eqp':eqp,'ops':ops,'bindings':bindings,'reprepareBeforeRun':4 if a.case=='lifetime' else None,'runs':runs})
 assert variant['modes'][0]['columns']==variant['modes'][1]['columns']
 for on,off in zip(variant['modes'][0]['runs'],variant['modes'][1]['runs']):
  assert on['rows']==off['rows'] and on['rc']==off['rc']
 assert d.sqlite3_close(db)==0
 result['variants'].append(variant)
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'receipt':str(out/'native.json'),'sha256':hashlib.sha256((out/'native.json').read_bytes()).hexdigest(),'variants':[{'encoding':v['encoding'],'modes':[{'enabled':m['automaticIndex'],'rows':len(m['runs'][0]['rows']),'scan':m['runs'][0]['fullscanSteps'],'build':m['runs'][0]['autoindexRows']} for m in v['modes']]} for v in result['variants']]},indent=2))
