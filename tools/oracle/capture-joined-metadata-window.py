import ctypes as C, pathlib,json,sys,importlib.util,hashlib,os,base64
root=pathlib.Path(os.environ['COMMON_CHECKPOINT_OUTPUT']);root.mkdir(parents=True,exist_ok=True);source=pathlib.Path(os.environ['COMMON_CHECKPOINT_SOURCE'])
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.load(open(source/'reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
sqls=['SELECT t.x,p.cid,row_number() OVER (ORDER BY t.x,p.cid) FROM t JOIN pragma_table_info(t.nm) p', 'SELECT t.x,p.cid,p.name,p.arg,row_number() OVER (PARTITION BY t.x ORDER BY p.cid DESC) FROM t JOIN pragma_table_xinfo(t.nm) p WHERE p.cid>0 ORDER BY t.x,p.cid DESC', "SELECT t.x,p.cid,row_number() OVER (ORDER BY t.x,p.cid) FROM t LEFT JOIN pragma_table_info('absent') p ON p.cid=0", 'SELECT t.x,p.cid,row_number() OVER (ORDER BY t.x,p.cid) FROM t JOIN pragma_table_info(NULL) p', "SELECT g.x,g.y,p.cid,row_number() OVER (PARTITION BY g.y ORDER BY p.cid) FROM g JOIN pragma_table_info('g') p WHERE g.y>4", 'SELECT t.x,p.cid,row_number() OVER (ORDER BY t.x,p.cid) FROM t LEFT JOIN pragma_table_info(t.nm) p ON p.cid=1 WHERE t.x>1', "SELECT t.x,p.cid,rank() OVER (PARTITION BY t.nm ORDER BY p.cid),count(*) OVER (PARTITION BY t.x) FROM t JOIN pragma_table_info(t.nm,'main') p ORDER BY t.x,p.cid", 'SELECT count(*),sum(p.cid) FROM t LEFT JOIN pragma_table_info(t.nm) p ON p.cid=0', "SELECT count(*) FROM pragma_table_info('t')"]
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
   a['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(lambda v: None if v is None else v.decode())(getattr(d,'sqlite3_column_'+n)(st,i)) for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
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
 d.sqlite3_close(db);enc.append({'encoding':e,'base64':base64.b64encode(p.read_bytes()).decode(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(root/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'version':d.sqlite3_libversion().decode(),'librarySha':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':enc},indent=2))
