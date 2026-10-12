"""Pinned native-first generated consumer capture; disposable fixtures only."""
import ctypes as C,importlib.util,json,pathlib,sys,hashlib
root=pathlib.Path.cwd();spec=importlib.util.spec_from_file_location('native',root/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
d=n.load(sys.argv[1]);d.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];d.sqlite3_column_name.restype=C.c_char_p;assert d.sqlite3_sourceid().decode()==json.load(open('reference/sqlite/manifest.json'))['sqliteSourceId']
for field in ['decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+field);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);cases=[]
queries=[
"SELECT v,s FROM t INDEXED BY tvs WHERE v='A' COLLATE nocase ORDER BY s",
"SELECT v,s,z,d FROM t INDEXED BY tvs WHERE v='A' COLLATE nocase ORDER BY s",
"SELECT l.id,r.v,r.s,r.c FROM t l LEFT JOIN t r INDEXED BY tvs ON r.v='missing' COLLATE nocase ORDER BY l.id",

'SELECT l.id,l.v,r.v,l.s,l.d,l.z FROM t l JOIN t r ON l.id=r.id ORDER BY l.id',
'SELECT v,count(*),sum(s) FROM t GROUP BY v ORDER BY v',
'SELECT l.id,(SELECT r.d FROM t r WHERE r.id=l.id) FROM t l ORDER BY l.id',
'SELECT l.id,r.v,r.c,r.d FROM t l LEFT JOIN t r ON r.id=l.id+10 ORDER BY l.id',
'SELECT l.id,r.d FROM t l JOIN t r ON r.v=l.v COLLATE nocase WHERE l.s>0 ORDER BY l.id,r.id',
'SELECT l.v,count(*),sum(r.d) FROM t l JOIN t r ON l.id=r.id GROUP BY l.v ORDER BY l.v',
'SELECT id,v,s,d,z FROM t ORDER BY id',
"SELECT l.id,r.v,r.d FROM t l JOIN t r ON r.id=l.id WHERE l.v='A' COLLATE nocase ORDER BY l.id",
'SELECT l.d,count(*),sum(r.s) FROM t l LEFT JOIN t r ON r.id=l.id+10 GROUP BY l.d HAVING count(*)>0 ORDER BY l.d',
'SELECT l.id,(SELECT r."odd.name" FROM t r WHERE r.id=l.id) FROM t l ORDER BY l.id',
'SELECT l.id,r.z,r."odd.name" FROM t l JOIN t r ON r.id=l.id ORDER BY l.id',
]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/f'mixed-{enc}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 sql=f'''PRAGMA encoding='{enc}'; CREATE TABLE t(id INTEGER PRIMARY KEY,a, v TEXT COLLATE nocase AS (a) VIRTUAL,s REAL AS (id+0.5) STORED,d REAL AS (s+id) VIRTUAL,c INTEGER AS (99) VIRTUAL,z BLOB,"odd.name" TEXT AS (v||'!') VIRTUAL); INSERT INTO t(id,a,z) VALUES(1,'A',x'00ff'),(2,'a',x'01'),(3,NULL,NULL),(4,7,x''); CREATE INDEX ti ON t(v); CREATE INDEX tvs ON t(v,s);'''
 assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0
 for sql in queries:
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0;rows=[]
  for cycle in range(2):
   run=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==101:break
    assert rc==100
    row=[]
    for i in range(d.sqlite3_column_count(st)):
     k=d.sqlite3_column_type(st,i)
     if k==1:v=str(d.sqlite3_column_int64(st,i))
     elif k==2:v=d.sqlite3_column_double(st,i)
     elif k==3:v=C.string_at(d.sqlite3_column_text(st,i),d.sqlite3_column_bytes(st,i)).decode()
     elif k==4:v=C.string_at(d.sqlite3_column_blob(st,i),d.sqlite3_column_bytes(st,i)).hex()
     else:v=None
     row.append([['','integer','real','text','blob','null'][k],v])
    run.append(row)
   if cycle==0:rows=run
   else:assert rows==run
   assert d.sqlite3_reset(st)==0
  names=[d.sqlite3_column_name(st,i).decode() for i in range(d.sqlite3_column_count(st))]
  metadata=[]
  for i in range(d.sqlite3_column_count(st)):
   entry={'name':names[i]}
   for key,field in [('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    value=getattr(d,'sqlite3_column_'+field)(st,i);entry[key]=value.decode() if value else None
   metadata.append(entry)
  assert d.sqlite3_finalize(st)==0
  cases.append(dict(path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),sql=sql,rows=rows,names=names,metadata=metadata))
 assert d.sqlite3_close(db)==0
(out/'capture.json').write_text(json.dumps(cases,indent=2))
