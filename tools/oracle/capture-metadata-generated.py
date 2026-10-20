"""Pinned3.53.4 generated outer metadata consumers; .so and disposable directory argv."""
import ctypes as C, pathlib,sys,json,base64,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('exec',[P,C.c_char_p,P,P,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('column_double',[P,C.c_int],C.c_double),('column_text',[P,C.c_int],P),('column_blob',[P,C.c_int],P),('column_bytes',[P,C.c_int],C.c_int),('errmsg',[P],C.c_char_p)]:
 f=getattr(L,'sqlite3_'+n);f.argtypes=a;f.restype=r
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+n);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert L.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
def text(v):return v.decode() if v is not None else None
out={'sourceId':manifest['sqliteSourceId'],'encodings':[]}
work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=work/(enc+'.db');path.unlink(missing_ok=True);db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 ddl=f"""PRAGMA encoding='{enc}';
 CREATE TABLE target(a INTEGER,b TEXT,v AS (a+1),s AS (a+2) STORED);
 CREATE TABLE outer_t(id INTEGER PRIMARY KEY,base TEXT,v TEXT AS (base) VIRTUAL,s TEXT AS (base) STORED,tail TEXT,sc TEXT AS ('main') VIRTUAL,chain TEXT AS (coalesce(v,'')) VIRTUAL) STRICT;
 INSERT INTO outer_t(base,tail) VALUES('target','end'),(NULL,'null'),('missing','absent'),('','empty');
 CREATE TABLE empty_outer(id INTEGER PRIMARY KEY,base TEXT,v TEXT AS (base) VIRTUAL,s TEXT AS (base) STORED);
 """
 assert L.sqlite3_exec(db,ddl.encode(),None,None,None)==0
 queries=[]
 for mod in ['table_info','table_xinfo']:
  for join in ['JOIN','LEFT JOIN']:
   for col in ['base','v','s','chain']:
    queries.append(f'SELECT t.id,p.name FROM outer_t t {join} pragma_{mod}(t.{col}) p ON p.cid=0 ORDER BY t.id')
   queries += [
    f'SELECT t.id,t.v,t.s,t.tail,p.name,p.hidden,p.arg,p.schema FROM outer_t t {join} pragma_{mod}(t.v,t.sc) p ON p.cid=0 ORDER BY t.id' if mod=='table_xinfo' else f'SELECT t.id,t.v,t.s,t.tail,p.name,p.arg,p.schema FROM outer_t t {join} pragma_{mod}(t.v,t.sc) p ON p.cid=0 ORDER BY t.id',
    f'SELECT t.id,t.v,t.s,p.name FROM outer_t t {join} pragma_{mod} p ON p.arg=t.v AND p.schema=t.sc AND p.cid=0 ORDER BY t.id',
    f'SELECT t.id,p.name FROM outer_t t {join} pragma_{mod}(t.s) p ON p.cid=0 AND t.v IS NOT NULL WHERE t.s IS NOT NULL ORDER BY t.id',
    f'SELECT t.id,p.name FROM empty_outer t {join} pragma_{mod}(t.v) p ON p.cid=0',
    f'SELECT t.id,p.name FROM outer_t t {join} pragma_{mod}(t.v,\'absent\') p ON p.cid=0 WHERE t.id<0',
    f'SELECT t.id,p.name FROM outer_t t {join} pragma_{mod}(t.s,\'absent\') p ON p.cid=0',
    f'SELECT t.id,t.s AS stored,t.v AS virt,p.name FROM outer_t AS t {join} pragma_{mod}(t.v) AS p ON p.cid=0 ORDER BY stored,t.id',
   ]
 cases=[]
 for sql in queries:
  st=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc==0,(sql,text(L.sqlite3_errmsg(db)))
  width=L.sqlite3_column_count(st);metadata=[dict(zip(['name','declaredType','database','table','origin'],[text(getattr(L,'sqlite3_column_'+n)(st,i)) for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(width)]
  runs=[]
  for _ in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(st)
    if rc!=100:break
    row=[]
    for i in range(width):
     kind=L.sqlite3_column_type(st,i)
     if kind==1:value=str(L.sqlite3_column_int64(st,i))
     elif kind==2:value=L.sqlite3_column_double(st,i)
     elif kind in [3,4]:
      ptr=(L.sqlite3_column_text if kind==3 else L.sqlite3_column_blob)(st,i);b=C.string_at(ptr,L.sqlite3_column_bytes(st,i));value=b.decode() if kind==3 else b.hex()
     else:value=None
     row.append({'type':kind,'value':value})
    rows.append(row)
   error=text(L.sqlite3_errmsg(db)) if rc!=101 else None;reset=L.sqlite3_reset(st);assert reset==(rc if rc!=101 else 0)
   runs.append({'rows':rows,'rc':rc,'error':error})
  final=L.sqlite3_finalize(st);assert final==0
  cases.append({'sql':sql,'metadata':metadata,'runs':runs})
 assert L.sqlite3_close(db)==0
 data=path.read_bytes();out['encodings'].append({'encoding':enc,'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode(),'cases':cases})
print(json.dumps(out,indent=2))
