"""Pinned native-first witnesses for retained SrcItem -> AggInfo coroutine."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib, os
root=pathlib.Path(os.environ['COMMON_CHECKPOINT_OUTPUT']);root.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',pathlib.Path(__file__).with_name('capture-index-planner.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
child='SELECT x FROM t ORDER BY x DESC LIMIT 2'
queries=[f'SELECT sum(x) FROM ({child})', f'SELECT count(*) AS n,count(x) AS v,sum(x) AS s FROM ({child})', f'SELECT sum(d.v) AS total FROM (SELECT x AS v FROM t ORDER BY x DESC LIMIT 2) AS d',f'SELECT sum(x) AS s FROM ({child}) HAVING sum(x)>4 ORDER BY s',f'SELECT sum(x) AS s FROM ({child}) HAVING sum(x)>5 ORDER BY s',f'SELECT x,count(*) FROM ({child}) GROUP BY x HAVING count(*)>0 ORDER BY x', 'SELECT sum(x),count(*),count(x) FROM (SELECT x FROM t WHERE x IS NULL ORDER BY x DESC LIMIT 2)', 'SELECT sum(x),count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 0)', 'SELECT sum(x),count(*) FROM (SELECT x FROM t WHERE x>99 ORDER BY x DESC LIMIT 2)', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2 OFFSET 1)', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT -1)', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2) LIMIT 0', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2) LIMIT 1 OFFSET 1', 'SELECT a.x,(SELECT sum(d.x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2) d WHERE d.x=a.x) AS s FROM t a WHERE a.x IS NOT NULL ORDER BY a.x', "SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 'bad')", 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT NULL)', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2 OFFSET NULL)', 'SELECT sum(z) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2)', 'SELECT sum(x) FROM (SELECT x FROM t ORDER BY x DESC LIMIT x)']
# Adjacent grouping must preserve coroutine order, repeated keys, empty/NULL,
# and use an output sorter when ORDER is not the GROUP expression list.
queries += [
 'SELECT v,count(*) FROM (SELECT x AS v FROM t ORDER BY v DESC LIMIT 4) GROUP BY v ORDER BY v',
 'SELECT v,count(*) FROM (SELECT x AS v FROM t ORDER BY 1 DESC LIMIT 4) GROUP BY v ORDER BY v',

 'SELECT x,count(*) FROM (SELECT x FROM t ORDER BY x ASC LIMIT 3) GROUP BY x ORDER BY x',
 'SELECT x,count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT -1) GROUP BY x ORDER BY x',
 'SELECT x,count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 0) GROUP BY x ORDER BY x',
 'SELECT x,count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 4) GROUP BY x ORDER BY count(*) DESC,x ASC',
 'SELECT x,count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 4) GROUP BY x HAVING count(*)>0 ORDER BY x LIMIT 1 OFFSET 1',
 'SELECT x,count(*) FROM (SELECT x FROM t UNION ALL SELECT x FROM t ORDER BY x DESC LIMIT 8) GROUP BY x ORDER BY x',
 'SELECT a.x,(SELECT count(*) FROM (SELECT x FROM t ORDER BY x DESC LIMIT 4) d WHERE d.x=a.x GROUP BY d.x) FROM t a ORDER BY a.x',
]
images=[]
for e in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(e+'.sqlite');assert not p.exists();db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 for q in [f"PRAGMA encoding='{e}'",'CREATE TABLE t(x INTEGER)', 'INSERT INTO t VALUES(1),(2),(3),(NULL)']:m.execsql(d,db,q)
 d.sqlite3_close(db);db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for q in queries:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);a={'sql':q,'prepare':rc}
  if rc==0:
   a['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
   for repeat in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    a['runs'].append({'rows':rows,'end':rc,'error':d.sqlite3_errmsg(db).decode() if rc!=101 else None});d.sqlite3_reset(st)
   d.sqlite3_finalize(st)
  else:a['error']=d.sqlite3_errmsg(db).decode()
  cases.append(a)
 d.sqlite3_close(db);images.append({'encoding':e,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(root/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':images},indent=2))
