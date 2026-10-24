#!/usr/bin/env python3
"""Bounded development witness, not a runtime backend or complete beta.5 suite.
Run: python3 docs/research/where-autoindex-capture.py --library LIB --output DIR
Uses the existing typed native harness; databases and receipt remain in work storage.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);p.add_argument('--case',default='original',choices=['original','absent','collision','inner','on','where','is','empty-inner','empty-outer','types','nocase','rtrim','binary','lifetime','representations','standalone','standalone-ipk','pulldown-ipk','pulldown-ipk-dependent','pulldown','pulldown-dependent','overflow','overflow-offpath','affinity','affinity-reverse']);a=p.parse_args()
out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
d=h.load(a.library)
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
d.sqlite3_extended_errcode.argtypes=[C.c_void_p];d.sqlite3_extended_errcode.restype=C.c_int
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
if a.case in ['overflow','overflow-offpath']:
 sql=sql.replace('r.k=l.k','r.k=l.k AND CASE WHEN l.k=17 THEN 1 ELSE abs(-9223372036854775808) END>0')
if a.case in ['nocase','rtrim','binary']:
 sql=sql.replace('r.k=l.k',f'r.k=l.k AND r.payload=l.c COLLATE {a.case.upper()}')
if a.case=='representations': sql='SELECT l.id AS lid,r.id AS rid,l.k AS lk,r.k AS rk FROM lhs l LEFT JOIN rhs r ON r.k=l.k ORDER BY l.id,r.id'
cross_affinity=a.case in ['affinity','affinity-reverse']
if cross_affinity:
 sql='SELECT l.id AS lid,r.id AS rid,l.k AS lk,r.k AS rk FROM lhs l LEFT JOIN rhs r ON r.k=l.k AND r.payload=l.c COLLATE NOCASE ORDER BY l.id,r.id'
ipk=a.case=='standalone-ipk'
if ipk: sql="SELECT l.id AS lid,r.id AS rid,r.payload FROM lhs l CROSS JOIN rhs r WHERE r.id=l.k AND r.payload='v2' ORDER BY l.id,r.id"
if a.case=='standalone': sql="SELECT l.id AS lid,r.id AS rid,r.payload FROM lhs l CROSS JOIN rhs r WHERE r.k=l.k AND r.payload='v2' ORDER BY l.id,r.id"
multi=a.case in ['pulldown','pulldown-dependent','pulldown-ipk','pulldown-ipk-dependent']
ipk_multi=a.case in ['pulldown-ipk','pulldown-ipk-dependent']
if multi:
 key='l.k' if a.case=='pulldown' else 'r.k'
 sql=f"SELECT l.id AS lid,r.id AS rid,t.id AS tid FROM lhs l JOIN rhs r JOIN tail t WHERE r.k=l.k AND t.k={key} AND r.payload='v2' AND t.payload='v2' ORDER BY l.id,r.id,t.id"
if ipk_multi:
 key='l.k' if a.case=='pulldown-ipk' else 'r.id'
 join=' CROSS JOIN ' if a.case=='pulldown-ipk-dependent' else ' JOIN '
 sql=f"SELECT l.id AS lid,r.id AS rid,t.id AS tid FROM lhs l{join}rhs r{join}tail t WHERE r.k=l.k AND t.id={key} AND r.payload='v2' AND t.payload='v2' ORDER BY l.id,r.id,t.id"
result={'case':a.case,'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(a.library).read_bytes()).hexdigest(),'sql':sql,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(enc+'.db');assert not path.exists(),path
 db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 affinity='' if a.case=='representations' else 'INTEGER'
 h.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE lhs(id INTEGER PRIMARY KEY,k {affinity}); CREATE TABLE rhs(id INTEGER PRIMARY KEY,k {affinity},payload TEXT);")
 h.execsql(d,db,'WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<64) INSERT INTO lhs SELECT x,CASE WHEN x=64 THEN NULL ELSE x%16 END FROM n;')
 h.execsql(d,db,"WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<128) INSERT INTO rhs SELECT x,CASE WHEN x=128 THEN NULL ELSE x%16 END,'v'||x FROM n;")
 if cross_affinity:
  # Recreate declared affinities, not CAST expressions that lose column ownership.
  left,right=('TEXT','INTEGER') if a.case=='affinity' else ('INTEGER','TEXT')
  h.execsql(d,db,f'DROP TABLE lhs; DROP TABLE rhs; CREATE TABLE lhs(id INTEGER PRIMARY KEY,k {left},c TEXT); CREATE TABLE rhs(id INTEGER PRIMARY KEY,k {right},payload TEXT);')
  h.execsql(d,db,"WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<64) INSERT INTO lhs SELECT x,CASE x%4 WHEN 0 THEN '01' WHEN 1 THEN '1' WHEN 2 THEN 'x' ELSE NULL END,'a' FROM n; WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<128) INSERT INTO rhs SELECT x,CASE x%4 WHEN 0 THEN '01' WHEN 1 THEN '1' WHEN 2 THEN '2' ELSE NULL END,'A' FROM n;")
 if a.case in ['nocase','rtrim','binary']:
  h.execsql(d,db,"ALTER TABLE lhs ADD COLUMN c TEXT; UPDATE lhs SET c=CASE id%3 WHEN 0 THEN 'A'||char(0)||'x' WHEN 1 THEN 'a ' ELSE 'A' END; UPDATE rhs SET payload=CASE id%3 WHEN 0 THEN 'a'||char(0)||'y' WHEN 1 THEN 'a' ELSE 'A' END;")
 if a.case in ['absent','collision']:
  # Native filterHash numeric addition, 10000-byte filter: 80001 collides
  # with present key 1 modulo 80000; 17 has an absent bit. No host hash.
  h.execsql(d,db,f'UPDATE lhs SET k={17 if a.case=="absent" else 80001} WHERE id<64;')
 if a.case=='empty-inner': h.execsql(d,db,'DELETE FROM rhs;')
 if a.case=='overflow-offpath': h.execsql(d,db,'UPDATE lhs SET k=17;')
 if a.case=='empty-outer': h.execsql(d,db,'DELETE FROM lhs;')
 if a.case=='types':
  h.execsql(d,db,"UPDATE lhs SET k=CASE id%8 WHEN 0 THEN 1.0 WHEN 1 THEN 1.5 WHEN 2 THEN '01' WHEN 3 THEN 'x' WHEN 4 THEN x'31' WHEN 5 THEN -1 WHEN 6 THEN NULL ELSE 80001 END; UPDATE rhs SET k=CASE id%7 WHEN 0 THEN 1 WHEN 1 THEN 1.5 WHEN 2 THEN '01' WHEN 3 THEN 'X' WHEN 4 THEN x'31' WHEN 5 THEN -1 ELSE NULL END;")
 if a.case=='representations':
  # No declared affinity preserves REAL 1.0 in storage, unlike INTEGER.
  h.execsql(d,db,"UPDATE lhs SET k=CASE id%8 WHEN 0 THEN 1.0 WHEN 1 THEN 1 WHEN 2 THEN '1' WHEN 3 THEN x'31' WHEN 4 THEN -1.0 WHEN 5 THEN -1 WHEN 6 THEN NULL ELSE 17 END; UPDATE rhs SET k=CASE id%8 WHEN 0 THEN 1 WHEN 1 THEN 1.0 WHEN 2 THEN '1' WHEN 3 THEN x'31' WHEN 4 THEN -1 WHEN 5 THEN -1.0 WHEN 6 THEN NULL ELSE 80001 END;")
 if a.case=='standalone' or multi:
  h.execsql(d,db,"CREATE INDEX rk ON rhs(k); WITH RECURSIVE n(x) AS(VALUES(65) UNION ALL SELECT x+1 FROM n WHERE x<1024) INSERT INTO lhs SELECT x,x%32 FROM n; ANALYZE;")
 if ipk:
  # Keep heterogeneous probe storage; native MustBeInt must precede hashing.
  h.execsql(d,db,"DROP TABLE lhs; CREATE TABLE lhs(id INTEGER PRIMARY KEY,k); WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1024) INSERT INTO lhs SELECT x,CASE x%8 WHEN 0 THEN 2 WHEN 1 THEN 2.0 WHEN 2 THEN '2.0' WHEN 3 THEN 2.5 WHEN 4 THEN 'bad' WHEN 5 THEN x'32' WHEN 6 THEN NULL ELSE 80002 END FROM n; ANALYZE;")
 if multi:
  h.execsql(d,db,'CREATE TABLE tail(id INTEGER PRIMARY KEY,k INTEGER,payload TEXT); INSERT INTO tail SELECT * FROM rhs; CREATE INDEX tk ON tail(k); ANALYZE;')
 assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 variant={'encoding':enc,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'modes':[]}
 for enabled in [True,False]:
  h.execsql(d,db,'PRAGMA automatic_index='+('ON' if enabled and not multi else 'OFF'))
  if a.case=='standalone' or ipk:
   # SQLITE_TESTCTRL_OPTIMIZATIONS=15; sqliteInt.h SQLITE_BloomFilter.
   d.sqlite3_test_control(15,db,0 if enabled else 0x00080000)
  if multi: d.sqlite3_test_control(15,db,0x80 | (0 if enabled else 0x00100000))
  eqp,_=h.query(d,db,'EXPLAIN QUERY PLAN '+sql);ops,_=h.query(d,db,'EXPLAIN '+sql)
  names=[h.text(row[1]) for row in ops]
  assert ('OpenAutoindex' in names)==(enabled and a.case!='standalone' and not ipk and not multi)
  if a.case in ['overflow','overflow-offpath']:
   functions=[i for i,n in enumerate(names) if n=='Function']
   assert len(functions)==1 and any('abs(1)' in h.text(row[5]) for row in ops if h.text(row[1])=='Function')
   if enabled: assert names.index('Filter')<names.index('SeekGE')<functions[0]
  if ipk:
   assert 'SeekRowid' in names and 'OpenAutoindex' not in names
   if enabled: assert names.index('MustBeInt')<names.index('Filter')<names.index('SeekRowid')
  if a.case=='standalone':
   assert 'SeekGE' in names
   assert any('USING INDEX rk' in h.text(row[3]) for row in eqp)
  if a.case!='is':
   bloom=(enabled and a.case!='affinity-reverse') or multi
   assert ('FilterAdd' in names)==bloom and ('Filter' in names)==bloom
  if cross_affinity and enabled:
   detail=' '.join(h.text(row[3]) for row in eqp)
   assert ('(k=?' in detail)==(a.case=='affinity')
   assert 'AUTOMATIC COVERING INDEX' in detail
   if a.case=='affinity':
    assert names.index('Affinity')<names.index('Filter')<names.index('SeekGE')
    assert h.text(ops[names.index('Affinity')][5])=='C'
   else:
    assert '(payload=?)' in detail and 'Filter' not in names
    assert names.index('SeekGE')<names.index('Ne')
  if multi:
   filters=[i for i,n in enumerate(names) if n=='Filter']
   seeks=[i for i,n in enumerate(names) if n in ['SeekGE','SeekRowid']]
   assert len(filters)==2 and len(seeks)==2
   early=filters[1]<seeks[0]
   assert early==(enabled and a.case in ['pulldown','pulldown-ipk'])
   if ipk_multi: assert names.index('MustBeInt')<filters[1]<seeks[1]
   assert names.count('Once')==(1 if early else 2)
   if early:
    assert ops[filters[0]][3]==ops[filters[1]][3]==ops[seeks[0]][3]
   placement={'laterFilterBeforeFirstSeek':early,'onceBlocks':names.count('Once'),
              'order':[n for n in names if n in ['Once','FilterAdd','Filter','SeekGE']]}
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
   assert rc==(1 if a.case=='overflow' else 101)
   error=None
   if rc!=101:
    error={'code':rc,'extendedCode':d.sqlite3_extended_errcode(db),'message':d.sqlite3_errmsg(db).decode()}
    assert error=={'code':1,'extendedCode':1,'message':'integer overflow'} and rows==[]
   runs.append({'rows':rows,'rc':rc,'fullscanSteps':d.sqlite3_stmt_status(st,1,1),'autoindexRows':d.sqlite3_stmt_status(st,3,1),'vmSteps':d.sqlite3_stmt_status(st,4,1),'filterHit':d.sqlite3_stmt_status(st,8,1),'filterMiss':d.sqlite3_stmt_status(st,7,1)})
   reset_rc=d.sqlite3_reset(st)
   assert reset_rc==(1 if a.case=='overflow' else 0)
   if a.case in ['overflow','overflow-offpath']: runs[-1].update({'error':error,'resetRc':reset_rc})
  for i in range(0,len(runs),2): assert runs[i]==runs[i+1]
  if multi:
   assert len(rows)==34 and runs[0]['autoindexRows']==0
  if cross_affinity:
   assert len(rows)==2080
   matches=[row for row in rows if row[1]['type']!='null']
   assert len(matches)==2048
   assert all(row[2]['type']==('text' if a.case=='affinity' else 'integer') for row in matches)
   assert all(row[3]['type']==('integer' if a.case=='affinity' else 'text') for row in matches)
   texts={h.text(row[2 if a.case=='affinity' else 3]) for row in matches}
   assert texts=={'01','1'}
  if ipk:
   assert len(rows)==384 and runs[0]['autoindexRows']==0
   assert all(row[1]=={'type':'integer','value':'2'} for row in rows)
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
  if a.case=='overflow-offpath':
   assert len(rows)==64 and all(row[1]['type']=='null' for row in rows)
  if enabled and a.case in ['overflow','overflow-offpath']:
   assert (runs[0]['filterHit'],runs[0]['filterMiss'])==((0,1) if a.case=='overflow' else (64,0))
  assert d.sqlite3_finalize(st)==0
  variant['modes'].append({'automaticIndex':enabled and not multi,'columns':columns,'eqp':eqp,'ops':ops,'bindings':bindings,'reprepareBeforeRun':4 if a.case=='lifetime' else None,'runs':runs})
  if multi: variant['modes'][-1].update({'pulldownEnabled':enabled,'disabledOptimizations':0x80 | (0 if enabled else 0x00100000),'placement':placement})
 assert variant['modes'][0]['columns']==variant['modes'][1]['columns']
 for on,off in zip(variant['modes'][0]['runs'],variant['modes'][1]['runs']):
  assert on['rows']==off['rows'] and on['rc']==off['rc']
 assert d.sqlite3_close(db)==0
 result['variants'].append(variant)
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'receipt':str(out/'native.json'),'sha256':hashlib.sha256((out/'native.json').read_bytes()).hexdigest(),'variants':[{'encoding':v['encoding'],'modes':[{'enabled':m['automaticIndex'],'rows':len(m['runs'][0]['rows']),'scan':m['runs'][0]['fullscanSteps'],'build':m['runs'][0]['autoindexRows']} for m in v['modes']]} for v in result['variants']]},indent=2))
