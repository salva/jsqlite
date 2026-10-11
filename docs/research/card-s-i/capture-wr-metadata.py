"""Independent dev-only INNER primary witness; existing fixture bytes, fresh pinned engine."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[3]
lib=C.CDLL(sys.argv[1]); ptr=C.c_void_p
def fn(n,a,r=C.c_int):
 f=getattr(lib,n); f.argtypes=a; f.restype=r; return f
source=fn('sqlite3_sourceid',[],C.c_char_p)
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert source().decode()==manifest['sqliteSourceId']
open_=fn('sqlite3_open_v2',[C.c_char_p,C.POINTER(ptr),C.c_int,C.c_char_p]); close=fn('sqlite3_close',[ptr])
prep=fn('sqlite3_prepare_v2',[ptr,C.c_char_p,C.c_int,C.POINTER(ptr),ptr]); step=fn('sqlite3_step',[ptr]); final=fn('sqlite3_finalize',[ptr])
count=fn('sqlite3_column_count',[ptr]); typ=fn('sqlite3_column_type',[ptr,C.c_int]); integer=fn('sqlite3_column_int64',[ptr,C.c_int],C.c_longlong); text=fn('sqlite3_column_text',[ptr,C.c_int],C.c_char_p)
def query(db,sql):
 s=ptr(); assert prep(db,sql.encode(),-1,C.byref(s),None)==0
 rows=[]
 try:
  while True:
   rc=step(s)
   if rc==101: break
   assert rc==100
   rows.append([{'type':{1:'integer',3:'text',5:'null'}[typ(s,i)],'value':str(integer(s,i)) if typ(s,i)==1 else text(s,i).decode() if typ(s,i)==3 else None} for i in range(count(s))])
 finally: assert final(s)==0
 return rows
sql='SELECT w.k AS label,w.v AS amount,w.n+1 AS successor,(SELECT z.n FROM w AS z WHERE (z.a=1 AND z.n=w.n) OR (z.b=2 AND z.n=w.n) LIMIT 1) AS correlated FROM w WHERE a=1 OR b=2'
accessors={key:fn('sqlite3_column_'+suffix,[ptr,C.c_int],C.c_char_p) for key,suffix in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]}
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/'docs/research/card-s-i'/f'{enc}.db'; db=ptr(); assert open_(str(p).encode(),C.byref(db),1,None)==0
 try:
  st=ptr();assert prep(db,sql.encode(),-1,C.byref(st),None)==0
  try:
   def metadata():
    return [{k:(v.decode() if (v:=f(st,i)) is not None else None) for k,f in accessors.items()} for i in range(count(st))]
   before=metadata();assert step(st)==100;after=metadata();assert before==after
   variants.append({'encoding':enc,'fixtureSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'metadata':before})
  finally:assert final(st)==0
 finally:assert close(db)==0
print(json.dumps({'sourceId':source().decode(),'classification':'supplemental authored alias/expression/correlated scalar metadata witness; one SQL across three encodings','sql':sql,'variants':variants},ensure_ascii=False,indent=2))
