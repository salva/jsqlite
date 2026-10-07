#!/usr/bin/env python3
"""Development-only pinned-native FIRST tranche; no TypeScript execution credit."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py'); n=importlib.util.module_from_spec(s); s.loader.exec_module(n)
a=argparse.ArgumentParser(); a.add_argument('--library',required=True); a.add_argument('--output-dir',required=True); args=a.parse_args()
out=pathlib.Path(args.output_dir); out.mkdir(parents=True,exist_ok=True)
d=n.load(args.library); manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text()); assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']; assert d.sqlite3_libversion().decode()==manifest['version']
d.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_name.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p]; d.sqlite3_errmsg.restype=C.c_char_p
d.sqlite3_limit.argtypes=[C.c_void_p,C.c_int,C.c_int]
CALLBACK=C.CFUNCTYPE(C.c_int); d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,CALLBACK,C.c_void_p]
def open_db(path,readonly=False):
 db=C.c_void_p(); rc=d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None) if readonly else d.sqlite3_open(str(path).encode(),C.byref(db)); assert rc==0; return db
def runs(db,sql,bindings,interrupt=False):
 st=C.c_void_p(); rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
 if rc: return {'sql':sql,'prepareRc':rc,'error':d.sqlite3_errmsg(db).decode(),'runs':[]}
 columns=[d.sqlite3_column_name(st,i).decode() for i in range(d.sqlite3_column_count(st))]; result=[]
 for values in bindings:
  clear=d.sqlite3_clear_bindings(st); n.bind(d,st,values); rows=[]
  if interrupt:
   cb=CALLBACK(lambda:1); d.sqlite3_progress_handler(db,1,cb,None)
  while True:
   rc=d.sqlite3_step(st)
   if rc!=100: break
   rows.append([n.cell(d,st,i) for i in range(len(columns))])
  error=None if rc==101 else d.sqlite3_errmsg(db).decode()
  counters={key:d.sqlite3_stmt_status(st,code,1) for key,code in [('fullscanSteps',1),('sorts',2),('vmSteps',4)]}
  reset=d.sqlite3_reset(st)
  result.append({'bindings':values,'clearRc':clear,'rows':rows,'stepRc':rc,'error':error,'resetRc':reset,'nativeWork':counters})
 final=d.sqlite3_finalize(st)
 return {'sql':sql,'columns':columns,'prepareRc':0,'runs':result,'finalizeRc':final}
def capture(db,case):
 sql=case['sql']; bindings=case.get('bindings',[[]]); r=runs(db,sql,bindings)
 r.update({k:v for k,v in case.items() if k not in ('sql','bindings')})
 r['plans']=[{'bindings':b,'eqp':n.query(d,db,'EXPLAIN QUERY PLAN '+sql,b)[0],'program':n.query(d,db,'EXPLAIN '+sql,b)[0]} for b in bindings] if r['prepareRc']==0 else []
 return r
setup=["CREATE TABLE t1(a TEXT,b INT,c INT,d INT)","CREATE INDEX t1abc ON t1(a,b,c)","INSERT INTO t1 VALUES('abc',123,4,5),('abc',234,5,6),('abc',234,6,7),('abc',345,7,8),('def',567,8,9),('def',345,9,10),('bcd',100,6,11)","CREATE TABLE s(id INTEGER PRIMARY KEY,a TEXT COLLATE NOCASE,b INT,c INT,p TEXT,z BLOB)","CREATE INDEX sa ON s(a DESC,b,c)","CREATE INDEX sc ON s(c)","WITH RECURSIVE x(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<240) INSERT INTO s SELECT i,CASE WHEN i%3=0 THEN NULL WHEN i%3=1 THEN 'Alpha' ELSE 'béTa' END,i%4,i%7,'p'||i,x'00ff' FROM x", "CREATE TABLE w(a TEXT COLLATE NOCASE,b INT,c INT,p TEXT,PRIMARY KEY(a DESC,b)) WITHOUT ROWID", "CREATE INDEX wc ON w(c DESC,a COLLATE BINARY)", "WITH RECURSIVE x(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<240) INSERT INTO w SELECT CASE WHEN i%2=0 THEN 'Alpha' ELSE 'béTa' END,i,i%7,'p'||i FROM x", "ANALYZE", "UPDATE sqlite_stat1 SET stat='10000 5000 2000 10' WHERE idx='t1abc'", "UPDATE sqlite_stat1 SET stat='10000 5000' WHERE idx='sc'", "UPDATE sqlite_stat1 SET stat='10000 5000 100 1' WHERE idx='sa'", "UPDATE sqlite_stat1 SET stat='10000 5000 10' WHERE idx='sqlite_autoindex_w_1'", "UPDATE sqlite_stat1 SET stat='10000 2000 10 1' WHERE idx='wc'", "ANALYZE sqlite_schema"]
cases=[
 {'id':'upstream-one','origin':'skipscan1.test:1.2','sql':"SELECT a,b,c,d,'|' FROM t1 WHERE d<>99 AND b=345 ORDER BY a"},
 {'id':'upstream-two','origin':'skipscan1.test multiple-prefix family','sql':"SELECT a,b,c,d FROM t1 WHERE c=6 ORDER BY a,b"},
 {'id':'prefix-null-desc-affinity','sql':"SELECT id,a,b,c,z FROM s INDEXED BY sa WHERE b=? ORDER BY a DESC,c,id",'bindings':[[2],['2'],[2.0],[None],[2]]},
 {'id':'two-prefix-cover','sql':"SELECT a,b,c FROM s INDEXED BY sa WHERE c=3 ORDER BY a DESC,b,c"},
 {'id':'range-restart','sql':"SELECT id,a,b,c,p FROM s INDEXED BY sa WHERE b>=2 AND b<3 ORDER BY a DESC,b,c,id"},
 {'id':'in-restart','sql':"SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IN (3,NULL,1,3) AND c>=5 ORDER BY a DESC,b,c,id"},
 {'id':'is-null-suffix','sql':"SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IS NULL"},
 {'id':'reverse','sql':"SELECT a,b,c FROM s INDEXED BY sa WHERE b=2 ORDER BY a ASC,c DESC"},
 {'id':'collation-prefix','sql':"SELECT a,b,c FROM s INDEXED BY sa WHERE b=2 AND a COLLATE NOCASE='ALPHA' ORDER BY a DESC,c"},
 {'id':'joined-reset','sql':"SELECT t1.d,s.id,s.a FROM t1 CROSS JOIN s INDEXED BY sa WHERE t1.d=? AND s.b=t1.c%4 ORDER BY t1.d,s.id",'bindings':[[5],[999],[None],[5]]},
 {'id':'left-miss','sql':"SELECT t1.d,s.id FROM t1 LEFT JOIN s INDEXED BY sa ON s.b=99 WHERE t1.d=5"},
 {'id':'or-overlap','sql':"SELECT id,a,b,c,p FROM s WHERE (b=2 AND c>=5) OR c=6 ORDER BY id"},
 {'id':'wr-primary-cover','sql':"SELECT a,b FROM w WHERE b=17"},
 {'id':'wr-secondary-noncover','sql':"SELECT a,b,c,p FROM w INDEXED BY wc WHERE a COLLATE BINARY='Alpha' AND b<9 ORDER BY c DESC,b"},
 {'id':'wr-secondary-cover','sql':"SELECT a,b,c FROM w INDEXED BY wc WHERE a COLLATE BINARY='Alpha' AND b<9 ORDER BY c DESC,b"},
 {'id':'empty-prefix','sql':"SELECT id FROM s INDEXED BY sa WHERE b=99"},
 {'id':'prepare-error','sql':"SELECT missing FROM s WHERE b=2"},
]
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for control in ['stat1','noStats','noskipscan','lowDuplicates']:
  path=out/(enc.lower().replace('-','')+'-'+control+'.db'); path.unlink(missing_ok=True); db=open_db(path)
  n.execsql(d,db,"PRAGMA encoding='%s'"%enc)
  for sql in setup: n.execsql(d,db,sql)
  if control=='noStats': n.execsql(d,db,'DELETE FROM sqlite_stat1')
  if control=='noskipscan': n.execsql(d,db,"UPDATE sqlite_stat1 SET stat=stat||' noskipscan'")
  if control=='lowDuplicates': n.execsql(d,db,"UPDATE sqlite_stat1 SET stat='10000 10 5 1' WHERE idx IN ('sa','t1abc')")
  n.execsql(d,db,'ANALYZE sqlite_schema'); n.execsql(d,db,'VACUUM'); assert d.sqlite3_close(db)==0
  raw=path.read_bytes(); db=open_db(path,True)
  selected=cases if control=='stat1' else cases[:4]
  captures=[capture(db,c) for c in selected]
  variant={'encoding':enc,'control':control,'fixture':{'path':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'schema':n.query(d,db,'SELECT name,rootpage,sql FROM sqlite_schema ORDER BY name')[0],'stat1':n.query(d,db,'SELECT * FROM sqlite_stat1 ORDER BY tbl,idx')[0],'xinfo':{idx:n.query(d,db,'PRAGMA index_xinfo('+idx+')')[0] for idx in ['sa','wc','sqlite_autoindex_w_1']},'cases':captures}
  if control=='stat1':
   variant['progressInterrupt']=runs(db,'SELECT id FROM s INDEXED BY sa WHERE b=2',[[]],interrupt=True)
   disabled=CALLBACK(lambda:0); d.sqlite3_progress_handler(db,0,disabled,None)
   variant['interruptRecovery']=runs(db,'SELECT id FROM s INDEXED BY sa WHERE b=2',[[]])
   old=d.sqlite3_limit(db,0,16); variant['lengthLimit']=runs(db,'SELECT p||p||p||p||p||p||p||p FROM s WHERE b=2',[[]]); d.sqlite3_limit(db,0,old)
   variant['limitRecovery']=runs(db,'SELECT count(*) FROM s WHERE b=2',[[]])
  assert d.sqlite3_close(db)==0
  if control=='stat1':
   # Corrupt the selected persistent index root page, not the main file.
   bad=out/(path.stem+'-malformed.db'); damaged=bytearray(raw)
   root=int(next(r[1]['value'] for r in variant['schema'] if n.text(r[0])=='sa'))
   page=int.from_bytes(raw[16:18],'big') or 65536; damaged[(root-1)*page]=0; bad.write_bytes(damaged)
   corruptdb=open_db(bad,True)
   variant['malformedSelectedRoot']={'fixture':bad.name,'sha256':hashlib.sha256(damaged).hexdigest(),'rootPage':root,'capture':runs(corruptdb,'SELECT id FROM s INDEXED BY sa WHERE b=2',[[],[]])}
   assert d.sqlite3_close(corruptdb)==0
  variants.append(variant)
result={'schema':'skipscan-native-first/1','source':manifest,'librarySha256':hashlib.sha256(pathlib.Path(args.library).read_bytes()).hexdigest(),'producer':'docs/research/card-s-g/capture.py','runtimeChangesBeforeCapture':False,'readOnlyAfterSetup':True,'tsCredit':0,'setup':setup,'variants':variants}
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
print('captured',len(variants),'fixtures',sum(len(v['cases']) for v in variants),'cases; TS credit 0')
for v in variants:
 anys=sum(any('ANY(' in n.text(row[3]) for plan in c['plans'] for row in plan['eqp']) for c in v['cases'])
 print(v['encoding'],v['control'],'ANY cases',anys,'of',len(v['cases']))
