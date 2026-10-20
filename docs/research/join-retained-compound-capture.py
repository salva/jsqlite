"""Pinned native-first joined/retained compound diagnosis. Args: project output lib."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib, base64
source=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]);manifest=json.loads((source/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
sqls=[
('join-multioutput-compound','SELECT t.x,u.x FROM t JOIN u ON t.x=u.x UNION SELECT u.x,t.x FROM u JOIN t ON u.x=t.x ORDER BY 1,2'),
('retained-multioutput-compound','SELECT d.x,u.x FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2) d JOIN u ON d.x=u.x UNION SELECT t.x,u.x FROM t JOIN u ON t.x=u.x ORDER BY 1,2')]
# Exercise the same resolved producers, not scalar stand-ins.
for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
 for retained in [False,True]:
  left='(SELECT x,nm FROM t ORDER BY x DESC LIMIT 2) d' if retained else 't d'
  for width in [2,3]:
   fields='d.x,u.x'+(',d.nm' if width==3 else '')
   right='t.x,u.x'+(',t.nm' if width==3 else '')
   sqls.append((f'{op}-{retained}-{width}',f'SELECT {fields} FROM {left} JOIN u ON d.x=u.x {op} SELECT {right} FROM t JOIN u ON t.x=u.x ORDER BY 2,1'))
for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
 for predicate in ['d.x<0','u.x<0']:
  sqls.append((f'empty-{op}-{predicate}',f'SELECT d.x,u.x FROM t d JOIN u ON d.x=u.x WHERE {predicate} {op} SELECT t.x,u.x FROM t JOIN u ON t.x=u.x ORDER BY 2,1'))
 sqls.append((f'typed-{op}',f"SELECT d.x,CASE WHEN d.x=2 THEN NULL ELSE d.nm END,CAST(u.x AS REAL) FROM t d JOIN u ON d.x=u.x {op} SELECT t.x,NULL,CAST(u.x AS REAL) FROM t JOIN u ON t.x=u.x ORDER BY 3,1,2"))
sqls.append(('unordered-all','SELECT t.x,u.x FROM t JOIN u ON t.x=u.x UNION ALL SELECT u.x,t.x FROM u JOIN t ON u.x=t.x LIMIT 3 OFFSET 1'))
sqls.append(('local-distinct','SELECT DISTINCT t.nm,u.x FROM t JOIN u ON u.x>1 UNION SELECT t.nm,u.x FROM t JOIN u ON u.x=t.x ORDER BY 2,1'))
# Additional source-based projections exercise collation, BLOB, mixed association
# and lexical parameter rebinding on actual joined producers.
for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
 sqls.append((f'collation-{op}',f"SELECT t.nm COLLATE NOCASE AS name,u.x FROM t JOIN u ON t.x=u.x {op} SELECT upper(t.nm),u.x FROM t JOIN u ON t.x=u.x ORDER BY name COLLATE RTRIM,2"))
 sqls.append((f'blob-{op}',f"SELECT CAST(t.nm AS BLOB),u.x FROM t JOIN u ON t.x=u.x {op} SELECT CAST(t.nm AS BLOB),u.x FROM t JOIN u ON t.x=u.x ORDER BY 2,1"))
sqls.extend([
 ('mixed-chain','SELECT t.x,u.x FROM t JOIN u ON t.x=u.x UNION SELECT u.x,t.x FROM u JOIN t ON u.x=t.x EXCEPT SELECT t.x,u.x FROM t JOIN u ON t.x=u.x WHERE t.x=2 ORDER BY 2,1'),
 ('skipped-projection',"SELECT abs(-9223372036854775808),u.x FROM t JOIN u ON t.x=u.x WHERE t.x<0 UNION SELECT t.x,u.x FROM t JOIN u ON t.x=u.x ORDER BY 2,1"),
 ('parameter-rebind','SELECT t.x+?1,u.x FROM t JOIN u ON t.x=u.x WHERE u.x>=?2 UNION SELECT t.x+?1,u.x FROM t JOIN u ON t.x=u.x ORDER BY 2,1 LIMIT ?3'),
])
# Exact lead fixtures for affected sources; unrelated lead tables are unused.
enc=[]
for e in ['UTF-8','UTF-16le','UTF-16be']:
 p=out/(e+'.sqlite');assert not p.exists();db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 m.execsql(d,db,"PRAGMA encoding='%s'"%e)
 for q in ['CREATE TABLE t(x INTEGER,js TEXT,nm TEXT)',"INSERT INTO t VALUES(1,'[10,11]','t'),(2,'[20]','u'),(3,'[]','t')",'CREATE TABLE u(x INTEGER)','INSERT INTO u VALUES(2),(3),(4)']:m.execsql(d,db,q)
 d.sqlite3_close(db);assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for label,q in sqls:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);assert rc==0
  a={'label':label,'sql':q,'prepare':rc,'metadata':[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))],'runs':[]}
  for iteration in range(2):
   binding=[iteration+1,2,iteration+1] if '?' in q else None
   if binding:
    d.sqlite3_bind_int64.argtypes=[C.c_void_p,C.c_int,C.c_longlong]
    for index,value in enumerate(binding,1):assert d.sqlite3_bind_int64(st,index,value)==0
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   a['runs'].append({'rows':rows,'end':rc,**({'binding':binding} if binding else {})});assert d.sqlite3_reset(st)==0
  d.sqlite3_finalize(st);cases.append(a)
 d.sqlite3_close(db);enc.append({'encoding':e,'file':str(p),'base64':base64.b64encode(p.read_bytes()).decode(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(out/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'encodings':enc},indent=2)+'\n')
