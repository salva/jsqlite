import ctypes as C, pathlib,json,sys,importlib.util,hashlib,os
root=pathlib.Path(os.environ['COMMON_CHECKPOINT_OUTPUT']);root.mkdir(parents=True,exist_ok=True);source=pathlib.Path(os.environ['COMMON_CHECKPOINT_SOURCE'])
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.load(open(source/'reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
sqls=["SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2)","SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x","SELECT x FROM t INTERSECT SELECT x FROM u ORDER BY x","SELECT x FROM t EXCEPT SELECT x FROM u ORDER BY x","WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<3) SELECT sum(t.x) FROM r JOIN t ON r.x=t.x","SELECT t.x,j.value FROM t JOIN json_each(t.js) j ORDER BY t.x,j.key","SELECT t.x,p.name FROM t JOIN pragma_table_info('t') p ON p.cid=0 ORDER BY t.x","SELECT t.x,p.name FROM t JOIN pragma_table_info(t.nm) p ON p.cid=0 ORDER BY t.x","SELECT x,y,typeof(y) FROM g ORDER BY x","SELECT x FROM audit ORDER BY x","SELECT x,js FROM t ORDER BY x"]
sqls += ["SELECT t.x,j.value FROM t JOIN json_each(t.js) j","SELECT t.x,p.name FROM t JOIN pragma_table_info('t') p ON p.cid=0","WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<3) SELECT t.x FROM r JOIN t ON r.x=t.x","SELECT x FROM t UNION SELECT x FROM u ORDER BY x"]
enc=[]
for e in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(e+'-corrected.sqlite');assert not p.exists(), 'use a fresh output root';db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 m.execsql(d,db,"PRAGMA encoding='%s'"%e)
 for q in ["CREATE TABLE t(x INTEGER,js TEXT,nm TEXT)","INSERT INTO t VALUES(1,'[10,11]','t'),(2,'[20]','u'),(3,'[]','t')","CREATE TABLE u(x INTEGER)","INSERT INTO u VALUES(2),(3),(4)","CREATE TABLE g(x INTEGER,y INTEGER GENERATED ALWAYS AS(x*2) STORED) STRICT","INSERT INTO g(x) VALUES(2),(3)","CREATE TABLE audit(x INTEGER)","CREATE TRIGGER tr AFTER INSERT ON g BEGIN INSERT INTO audit VALUES(new.y); END","INSERT INTO g(x) VALUES(4)"] :m.execsql(d,db,q)
 d.sqlite3_close(db);db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for q in sqls:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);a={'sql':q,'prepare':rc}
  if rc==0:
   a['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
   for repeat in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    a['runs'].append({'rows':rows,'end':rc});d.sqlite3_reset(st)
   d.sqlite3_finalize(st)
  else:a['error']=d.sqlite3_errmsg(db).decode()
  cases.append(a)
 d.sqlite3_close(db);enc.append({'encoding':e,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(root/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'version':d.sqlite3_libversion().decode(),'librarySha':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':enc},indent=2))
