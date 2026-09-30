#!/usr/bin/env python3
"""Development-only pinned fixture generator; verification opens snapshots read-only."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('ordinary',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(p);p.loader.exec_module(m)
SOURCE=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
OUT=ROOT/'test/conformance/cases/in-range-stat-native.json'
SQL={
 'in-composite': 'SELECT id,a,b,typeof(c),c,tag FROM t INDEXED BY t_ab WHERE a IN (?1,?2,?3,?4) AND b>=?5 AND b<=?6 AND c>?7 ORDER BY a,b,id',
 'in-composite-unforced': 'SELECT id,a,b,typeof(c),c,tag FROM t WHERE a IN (?1,?2,?3,?4) AND b>=?5 AND b<=?6 AND c>?7 ORDER BY a,b,id',
 'in-composite-scan': 'SELECT id,a,b,typeof(c),c,tag FROM t NOT INDEXED WHERE a IN (?1,?2,?3,?4) AND b>=?5 AND b<=?6 AND c>?7 ORDER BY a,b,id',
 'stat-choice': 'SELECT id FROM t WHERE a=1 AND b IN (13,14) ORDER BY id',
 'stat-choice-force-a': 'SELECT id FROM t INDEXED BY t_a WHERE a=1 AND b IN (13,14) ORDER BY id',
 'stat-choice-force-ab': 'SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b IN (13,14) ORDER BY id',
 'in-null': 'SELECT id,a,b FROM t INDEXED BY t_ab WHERE a IN (?1,?2,?3) AND b>=?4 AND b<?5 ORDER BY a,b,id',
}
PARAMS={'in-composite':[1,1.0,None,2,12,15,0.0], 'in-composite-unforced':[1,1.0,None,2,12,15,0.0], 'in-composite-scan':[1,1.0,None,2,12,15,0.0], 'stat-choice':[], 'stat-choice-force-a':[], 'stat-choice-force-ab':[], 'in-null':[None,1,1,13,15]}
def identity(d):
 if (d.sqlite3_libversion().decode(),d.sqlite3_sourceid().decode())!=(SOURCE['version'],SOURCE['sqliteSourceId']):raise RuntimeError('wrong pinned native library')
def open_db(d,path,readonly):
 db=C.c_void_p();rc=(d.sqlite3_open_v2(str(path).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None) if readonly else d.sqlite3_open(str(path).encode(),C.byref(db)))
 if rc!=m.OK:raise RuntimeError(f'open {path}: {rc}')
 return db
def build(d,root):
 root.mkdir(parents=True,exist_ok=True)
 for encoding,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
  for state in ('before','after'):
   f=root/f'in-range-stat-{encoding}-{state}.db';f.unlink(missing_ok=True);db=open_db(d,f,False)
   try:
    m.execsql(d,db,f"PRAGMA encoding='{pragma}'")
    for sql in ['CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c REAL,tag TEXT)', 'CREATE INDEX t_a ON t(a)', 'CREATE INDEX t_b ON t(b)', 'CREATE INDEX t_ab ON t(a,b)'] :m.execsql(d,db,sql)
    m.execsql(d,db,"INSERT INTO t VALUES(1001,NULL,13,1.0,'null'),(1002,1,13,NULL,'null-real'),(1003,1,14,2.5,'café'),(1004,2,15,3.0,'é')")
    m.execsql(d,db,'BEGIN')
    for i in range(1,301):m.execsql(d,db,f"INSERT INTO t VALUES({i},{i%3},{i%200},{i/10.0},'é')")
    m.execsql(d,db,'COMMIT')
    if state=='after':m.execsql(d,db,'ANALYZE')
   finally:d.sqlite3_close(db)
def full_vdbe(d,db,sql,params):
 rows,_=m.query(d,db,'EXPLAIN '+sql,params)
 return [{'addr':int(r[0]['value']),'opcode':m.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value']),'p4':None if r[5]['type']=='null' else m.text(r[5]),'p5':int(r[6]['value'])} for r in rows]
def capture(d,root):
 identity(d);variants=[]
 for encoding in ('utf8','utf16le','utf16be'):
  for state in ('before','after'):
   f=root/f'in-range-stat-{encoding}-{state}.db';db=open_db(d,f,True)
   try:
    stat1=m.query(d,db,'SELECT tbl,idx,stat FROM sqlite_stat1 ORDER BY idx')[0] if state=='after' else []
    tables=[m.text(r[0]) for r in m.query(d,db,"SELECT name FROM sqlite_schema WHERE name IN ('sqlite_stat1','sqlite_stat4') ORDER BY name")[0]]
    captured={}
    for name,sql in SQL.items():
     params=PARAMS[name];rows,counters=m.query(d,db,sql,params)
     captured[name]={'rows':rows,'counters':counters,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,params),'vdbe':full_vdbe(d,db,sql,params)}
    variants.append({'encoding':encoding,'state':state,'fixture':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'statTables':tables,'stat1':stat1,'cases':captured})
   finally:d.sqlite3_close(db)
 return {'schema':'jsqlite-in-range-stat-native/1','sourceId':SOURCE['sqliteSourceId'],'sql':SQL,'parameters':PARAMS,'variants':variants}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--regenerate',action='store_true');args=a.parse_args();d=m.load(args.library);identity(d)
 root=ROOT/'test/conformance/fixtures'
 if args.regenerate:build(d,root)
 result=capture(d,root)
 if args.regenerate:OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
 else:
  expected=json.loads(OUT.read_text())
  if result!=expected:raise SystemExit('frozen native capture differs')
  print('pinned read-only capture matches:',len(result['variants']),'snapshots')
