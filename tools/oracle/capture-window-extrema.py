"""Development-only packed extrema oracle; no product code imports.
Run: python3 tools/oracle/capture-window-extrema.py /path/to/pinned/libsqlite3.so
Optional --late-drains captures the finite sliding/following/EXCLUDE witnesses.
"""
import ctypes as C, hashlib, json, pathlib, struct, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,res in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('column_double',[P,C.c_int],C.c_double),('column_bytes',[P,C.c_int],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(L,'sqlite3_'+name);f.argtypes=args;f.restype=res
for name in ['name','decltype','database_name','table_name','origin_name','text','blob']:
 f=getattr(L,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=P
source=L.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
def string(p):return C.string_at(p).decode() if p else None
def cell(st,i):
 t=L.sqlite3_column_type(st,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(L.sqlite3_column_int64(st,i))}
 if t==2:return {'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(st,i)).hex()}
 p=(L.sqlite3_column_text if t==3 else L.sqlite3_column_blob)(st,i);n=L.sqlite3_column_bytes(st,i)
 return {'type':'text','value':C.string_at(p,n).decode()} if t==3 else {'type':'blob','hex':C.string_at(p,n).hex()}
queries=[]
for fn in ['min','max']:
 for expr in ['CASE i WHEN 1 THEN 1 WHEN 2 THEN 1.0 ELSE NULL END','CASE i WHEN 1 THEN 1.0 WHEN 2 THEN 1 ELSE NULL END','t COLLATE NOCASE',"'é'","x'00ff'",'NULL']:
  for suffix in ['', ' EXCLUDE NO OTHERS',' EXCLUDE CURRENT ROW',' EXCLUDE GROUP',' EXCLUDE TIES']:
   queries.append(f'SELECT i,{fn}({expr}) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW{suffix}) AS w FROM t ORDER BY i')
# Finite shared-label observer witnesses: ordinary sliding/following and the
# explicit fullscan owner that must not be overwritten by the sliding drain.
if len(sys.argv)>2:
 assert sys.argv[2]=='--late-drains'
 queries=[
  'SELECT i,r,t,b,n,sum(r) FILTER (WHERE i>1) OVER w AS s,count(i) OVER w AS c FROM t WINDOW w AS (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) ORDER BY i',
  'SELECT i,r,t,b,n,sum(r) FILTER (WHERE i>1) OVER w AS s,count(i) OVER w AS c FROM t WINDOW w AS (ORDER BY i ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) ORDER BY i',
  'SELECT i,min(CASE i WHEN 1 THEN 1 WHEN 2 THEN 1.0 ELSE NULL END) OVER (ORDER BY i ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) AS w FROM t ORDER BY i'
 ]
result={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
for fixture in ['typed','typed-utf-16le','typed-utf-16be']:
 path=root/'test/fixtures/aggregate-window'/f'{fixture}.db'
 db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 try:
  for sql in queries:
   st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
   try:
    columns=[dict(zip(['name','declaredType','database','table','origin'],[string(getattr(L,'sqlite3_column_'+f)(st,i)) for f in ['name','decltype','database_name','table_name','origin_name']])) for i in range(L.sqlite3_column_count(st))]
    runs=[]
    for _ in range(2):
     rows=[]
     while True:
      rc=L.sqlite3_step(st)
      if rc!=100:break
      rows.append([cell(st,i) for i in range(len(columns))])
     assert rc==101;assert L.sqlite3_reset(st)==0;runs.append(rows)
    result['variants'].append({'fixture':fixture,'fixtureSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sql':sql,'columns':columns,'runs':runs})
   finally:assert L.sqlite3_finalize(st)==0
 finally:assert L.sqlite3_close(db)==0
print(json.dumps(result,indent=2))
