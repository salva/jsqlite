import ctypes as C, pathlib,json,sys,importlib.util,hashlib,os
root=pathlib.Path(os.environ['COMMON_CHECKPOINT_OUTPUT']);root.mkdir(parents=True,exist_ok=True);source=pathlib.Path(os.environ['COMMON_CHECKPOINT_SOURCE'])
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.load(open(source/'reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
sqls=['SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x', 'SELECT x FROM t WHERE x IS NULL UNION SELECT x FROM u WHERE x IS NULL ORDER BY x', 'SELECT x FROM t WHERE x>99 UNION SELECT x FROM u WHERE x<0 ORDER BY x', 'SELECT x FROM t WHERE x>1 UNION ALL SELECT x FROM u WHERE x<4 ORDER BY x', 'SELECT x FROM t WHERE x IS NULL UNION ALL SELECT x FROM u WHERE x IS NULL ORDER BY x', 'SELECT x FROM t WHERE x>99 UNION ALL SELECT x FROM u WHERE x<0 ORDER BY x', 'SELECT x FROM t WHERE x>1 INTERSECT SELECT x FROM u WHERE x<4 ORDER BY x', 'SELECT x FROM t WHERE x IS NULL INTERSECT SELECT x FROM u WHERE x IS NULL ORDER BY x', 'SELECT x FROM t WHERE x>99 INTERSECT SELECT x FROM u WHERE x<0 ORDER BY x', 'SELECT x FROM t WHERE x>1 EXCEPT SELECT x FROM u WHERE x<4 ORDER BY x', 'SELECT x FROM t WHERE x IS NULL EXCEPT SELECT x FROM u WHERE x IS NULL ORDER BY x', 'SELECT x FROM t WHERE x>99 EXCEPT SELECT x FROM u WHERE x<0 ORDER BY x', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x', 'SELECT x+1 AS v FROM t WHERE x>1 UNION SELECT x+1 FROM u WHERE x<4 ORDER BY v DESC LIMIT 2 OFFSET 1', 'SELECT x FROM t WHERE x>1 UNION ALL SELECT x FROM u WHERE x<4', 'SELECT x COLLATE NOCASE AS v FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY v', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x COLLATE RTRIM', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY x+1', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 LIMIT 1.5', 'SELECT x FROM t WHERE missing>1 UNION SELECT x FROM u WHERE x<4', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE missing<4', 'SELECT x AS a FROM t WHERE x>1 UNION ALL SELECT x AS b FROM u WHERE x<4 ORDER BY a COLLATE RTRIM', 'SELECT x AS a FROM t WHERE x>1 INTERSECT SELECT x+0 AS b FROM u WHERE x<4 ORDER BY a COLLATE RTRIM', 'SELECT x AS a FROM t WHERE x>1 EXCEPT SELECT x AS b FROM u WHERE x<4 ORDER BY a COLLATE RTRIM', 'SELECT x AS a FROM t WHERE x>1 UNION SELECT x AS b FROM u WHERE x<4 UNION ALL SELECT x+0 FROM t WHERE x>2 ORDER BY a COLLATE RTRIM', 'SELECT x AS a FROM t WHERE x>1 UNION SELECT x AS b FROM u WHERE x<4 ORDER BY b COLLATE RTRIM', 'SELECT x FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 ORDER BY (x COLLATE RTRIM)']
enc=[]
# Source discriminators for BalancedMerge (>3 identical operators), caps,
# inherited ordering and mixed-operator left association. Native captured first.
for operator in ['UNION','UNION ALL']:
 for size in [4,5,6,7]:
  arms=['SELECT x AS v FROM '+('t' if i%2==0 else 'u')+' WHERE x>1' for i in range(size)]
  for suffix in [' ORDER BY v',' ORDER BY v DESC LIMIT 2 OFFSET 1',' ORDER BY v LIMIT -1 OFFSET -1']:
   sqls.append((' '+operator+' ').join(arms)+suffix)
for operator in ['INTERSECT','EXCEPT']:
 sqls.append('SELECT x AS v FROM t WHERE x>1 UNION SELECT x FROM u WHERE x<4 '+operator+' SELECT x FROM t WHERE x>2 UNION ALL SELECT x FROM u WHERE x<4 ORDER BY v DESC LIMIT 3 OFFSET 1')
sqls.extend(['SELECT 2 AS a,1 AS z UNION ALL SELECT 0 AS z,3 AS b ORDER BY z', 'SELECT 2 AS a,1 AS z UNION ALL SELECT 0 AS z,3 AS b ORDER BY z COLLATE BINARY'])
for e in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(e+'-corrected.sqlite');assert not p.exists(), 'use a fresh output root';db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 m.execsql(d,db,"PRAGMA encoding='%s'"%e)
 for q in ["CREATE TABLE t(x INTEGER,js TEXT,nm TEXT)","INSERT INTO t VALUES(1,'[10,11]','t'),(2,'[20]','u'),(3,'[]','t'),(2,'[]','t'),(NULL,'[]','t')","CREATE TABLE u(x INTEGER)","INSERT INTO u VALUES(2),(3),(4),(2),(NULL)","CREATE TABLE g(x INTEGER,y INTEGER GENERATED ALWAYS AS(x*2) STORED) STRICT","INSERT INTO g(x) VALUES(2),(3)","CREATE TABLE audit(x INTEGER)","CREATE TRIGGER tr AFTER INSERT ON g BEGIN INSERT INTO audit VALUES(new.y); END","INSERT INTO g(x) VALUES(4)"] :m.execsql(d,db,q)
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
