#!/usr/bin/env python3
"""Pinned development-only first STAT4 capture; never a runtime backend."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py')
n=importlib.util.module_from_spec(spec); spec.loader.exec_module(n)
out=pathlib.Path(__file__).parent
pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
profiles=[]
for lib in sys.argv[1:3]:
 d=n.load(lib); assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
 d.sqlite3_compileoption_get.argtypes=[C.c_int];d.sqlite3_compileoption_get.restype=C.c_char_p
 options=[]; i=0
 while (v:=d.sqlite3_compileoption_get(i)): options.append(v.decode());i+=1
 profiles.append({'librarySha256':hashlib.sha256(pathlib.Path(lib).read_bytes()).hexdigest(),'sourceId':d.sqlite3_sourceid().decode(),'compileOptions':options,'flags':'cc -std=c11 -O2 -g -fPIC -shared -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_MATH_FUNCTIONS'+(' -DSQLITE_ENABLE_STAT4' if 'ENABLE_STAT4' in options else '')+' sqlite3.c -lm'})
assert 'ENABLE_STAT4' in profiles[0]['compileOptions'] and 'ENABLE_STAT4' not in profiles[1]['compileOptions']
d=n.load(sys.argv[1]); variants=[]
cases=[('hot','SELECT id,r,b FROM t WHERE a=0 ORDER BY id'),('rare','SELECT id,r,b FROM t WHERE a=99 ORDER BY id'),('prefix','SELECT id,r,b FROM t WHERE a=0 AND b=7 ORDER BY id'),('range','SELECT id,r,b FROM t WHERE a=0 AND b>7 AND b<=9 ORDER BY id'),('literal-in','SELECT id,r,b FROM t WHERE a IN (99,98,NULL) ORDER BY id'),('null','SELECT id,r,b FROM t WHERE a IS NULL ORDER BY id'),('nocase','SELECT id,r,b FROM t WHERE s=\'HOT\' COLLATE nocase ORDER BY id'),('rtrim',"SELECT id,r,b FROM t WHERE s='hot ' COLLATE rtrim ORDER BY id"),('real','SELECT r FROM t WHERE r=7.0 ORDER BY id')]
# Keep explicit SQL literals; no SQL-text special cases in engine.

for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(enc+'.db');path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 setup=f"PRAGMA encoding='{enc}'; CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,r REAL,s TEXT); CREATE INDEX ab ON t(a,b DESC); CREATE INDEX ri ON t(r); CREATE INDEX sn ON t(s COLLATE nocase); CREATE INDEX sr ON t(s COLLATE rtrim); WITH RECURSIVE x(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<1000) INSERT INTO t SELECT i,CASE WHEN i<=900 THEN 0 WHEN i<=910 THEN NULL ELSE i-901 END,i%10,CAST(i%10 AS REAL),CASE WHEN i<=900 THEN 'hot' ELSE 'cold' END FROM x; CREATE TABLE tiny(a TEXT,b TEXT); CREATE INDEX ti ON tiny(a,b); INSERT INTO tiny VALUES('(0)','(0)'),('(1)','(1)'),('(2)','(2)'),('(3)','(3)'),('(4)','(4)'); ANALYZE;"
 n.execsql(d,db,setup);assert d.sqlite3_close(db)==0
 samples=[];captures=[]
 for lib in sys.argv[1:3]:
  q=n.load(lib);db=C.c_void_p();assert q.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
  if lib==sys.argv[1]:
   raw,_=n.query(q,db,'SELECT idx,neq,nlt,ndlt,sample FROM sqlite_stat4 ORDER BY rowid')
   for row in raw: samples.append({'idx':n.text(row[0]),'neq':n.text(row[1]),'nlt':n.text(row[2]),'ndlt':n.text(row[3]),'counts':[[str(int(v)%(1<<64)) for v in n.text(c).split()] for c in row[1:4]],'hex':row[4]['hex']})
  runs=[]
  for id,sql in cases:
   rows,work=n.query(q,db,sql);runs.append({'id':id,'sql':sql,'rows':rows,'eqp':n.explain(q,db,'EXPLAIN QUERY PLAN ',sql,[]),'work':work})
  captures.append(runs);assert q.sqlite3_close(db)==0
 assert [c['rows'] for c in captures[0]]==[c['rows'] for c in captures[1]]
 variants.append({'encoding':enc,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'setup':setup,'samples':samples,'stat4':captures[0],'control':captures[1]})
(out/'first-native.json').write_text(json.dumps({'profiles':profiles,'variants':variants},indent=2)+'\n')
print('captured',len(variants),'encodings;',len(cases),'paired queries each')
