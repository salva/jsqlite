#!/usr/bin/env python3
"""Finite native malformed/count/control assertions from analyze9-7, read-only reopen."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
out=pathlib.Path(__file__).parent;pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
d=n.load(sys.argv[1]);assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
mutations={'empty':"UPDATE sqlite_stat4 SET sample=X'' WHERE rowid=1",'ffff':"UPDATE sqlite_stat4 SET sample=X'FFFF'",'zero-eq':"UPDATE sqlite_stat4 SET neq='0 0 0'",'zero-dlt':"UPDATE sqlite_stat4 SET ndlt='0 0 0'",'zero-lt':"UPDATE sqlite_stat4 SET nlt='0 0 0'",'overflow':"UPDATE sqlite_stat4 SET neq='18446744073709551616 18446744073709551617 1'",'no-sample':'DELETE FROM sqlite_stat4','no-stat':'DROP TABLE sqlite_stat4; DROP TABLE sqlite_stat1','stat1-only':'DROP TABLE sqlite_stat4','no-stat1':'DROP TABLE sqlite_stat1','wr-alias':"INSERT INTO sqlite_stat4 SELECT tbl,'w',neq,nlt,ndlt,sample FROM sqlite_stat4 WHERE tbl='w'"}
base="CREATE TABLE t1(a,b); CREATE INDEX i1 ON t1(a,b); INSERT INTO t1 VALUES(1,1),(2,2),(3,3),(4,4),(5,5); CREATE TABLE w(a,b,PRIMARY KEY(a,b)) WITHOUT ROWID; INSERT INTO w VALUES(1,1),(2,2),(3,3); ANALYZE;"
results=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for name,mutation in mutations.items():
  path=out/f'edge-{enc}-{name}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
  n.execsql(d,db,f"PRAGMA encoding='{enc}';"+base+mutation+';');assert d.sqlite3_close(db)==0
  profiles=[]
  for lib in sys.argv[1:3]:
   q=n.load(lib);assert q.sqlite3_sourceid().decode()==pin['sqliteSourceId'];assert q.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
   runs=[]
   for sql in ['SELECT * FROM t1 WHERE a=1','SELECT * FROM t1 WHERE a=3','SELECT * FROM t1 WHERE a=5','SELECT * FROM w WHERE a=2']:
    rows,work=n.query(q,db,sql);runs.append({'sql':sql,'rows':rows,'eqp':n.explain(q,db,'EXPLAIN QUERY PLAN ',sql,[]),'work':work,'prepareRc':0,'stepRc':101})
   assert q.sqlite3_close(db)==0;profiles.append(runs)
  assert [r['rows'] for r in profiles[0]]==[r['rows'] for r in profiles[1]]
  assert profiles[0][0]['rows']==[[{'type':'integer','value':'1'},{'type':'integer','value':'1'}]],name
  rawStats=[]
  if name not in ['no-stat','stat1-only']:
   assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
   rawStats,_=n.query(d,db,'SELECT tbl,idx,neq,nlt,ndlt,sample FROM sqlite_stat4 ORDER BY rowid');assert d.sqlite3_close(db)==0
  results.append({'rawStats':rawStats,'encoding':enc,'name':name,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'mutation':mutation,'stat4':profiles[0],'control':profiles[1]})
(out/'edge-native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'base':base,'upstream':'test/analyze9.test 7.1-7.5 (isolated mutations rather than sequential reset)','variants':results},indent=2)+'\n')
print('native success assertions:',len(results)*4,'paired runs')
