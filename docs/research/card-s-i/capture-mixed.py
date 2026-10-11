"""Dev-only pinned SQLite capture; no runtime native dependency."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[3]
out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
lib=C.CDLL(sys.argv[1])
def fn(name,args,result=C.c_int):
 f=getattr(lib,name); f.argtypes=args; f.restype=result; return f
ptr=C.c_void_p
op=fn('sqlite3_open',[C.c_char_p,C.POINTER(ptr)])
prep=fn('sqlite3_prepare_v2',[ptr,C.c_char_p,C.c_int,C.POINTER(ptr),ptr])
step=fn('sqlite3_step',[ptr]); finalize=fn('sqlite3_finalize',[ptr]); close=fn('sqlite3_close',[ptr])
errmsg=fn('sqlite3_errmsg',[ptr],C.c_char_p)
count=fn('sqlite3_column_count',[ptr]); typ=fn('sqlite3_column_type',[ptr,C.c_int])
text=fn('sqlite3_column_text',[ptr,C.c_int],C.c_char_p)
integer=fn('sqlite3_column_int64',[ptr,C.c_int],C.c_longlong)
real=fn('sqlite3_column_double',[ptr,C.c_int],C.c_double)
name=fn('sqlite3_column_name',[ptr,C.c_int],C.c_char_p)
blob=fn('sqlite3_column_blob',[ptr,C.c_int],ptr)
size=fn('sqlite3_column_bytes',[ptr,C.c_int])
source=fn('sqlite3_sourceid',[],C.c_char_p)
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert source().decode()==manifest['sqliteSourceId']
def query(db,sql):
 s=ptr(); rc=prep(db,sql.encode(),-1,C.byref(s),None)
 if rc: return {'error':{'code':rc,'message':errmsg(db).decode()}}
 try:
  names=[name(s,i).decode() for i in range(count(s))]; rows=[]
  while True:
   rc=step(s)
   if rc==101: break
   assert rc==100,(rc,errmsg(db))
   row=[]
   for i in range(count(s)):
    t=typ(s,i)
    row.append({'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t], 'value':str(integer(s,i)) if t==1 else real(s,i) if t==2 else text(s,i).decode() if t==3 else C.string_at(blob(s,i),size(s,i)).hex() if t==4 else None})
   rows.append(row)
  return {'names':names,'rows':rows}
 finally:
  finalize(s)

variants=[]
sql="SELECT k,v FROM w WHERE a=1 OR b=2 OR a=3 ORDER BY k"
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(encoding+'.db');path.unlink(missing_ok=True);db=ptr();assert op(str(path).encode(),C.byref(db))==0
 try:
  for q in [f"PRAGMA encoding='{encoding}'","CREATE TABLE w(k COLLATE NOCASE PRIMARY KEY DESC,v,a,b) WITHOUT ROWID","CREATE INDEX wa ON w(a)","CREATE INDEX wb ON w(b)"]:
   assert 'error' not in query(db,q)
  keys=['1','1.5',"'Alpha'","'beta'","'Éclair'","x'00ff'","x'ff00'"]
  for i in range(400):
   key=keys[i] if i<len(keys) else str(i+20)
   assert 'error' not in query(db,f"INSERT INTO w VALUES({key},{i},{1 if i<7 else i%19},{2 if i<7 else i%23})")
  data=query(db,sql);eqp=query(db,'EXPLAIN QUERY PLAN '+sql);explain=query(db,'EXPLAIN '+sql)
 finally: close(db)
 variants.append({'encoding':encoding,'fixture':{'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'sql':sql,**data,'eqp':eqp,'explain':explain})
print(json.dumps({'sourceId':source().decode(),'classification':'one supplemental mixed typed PK SQL, not upstream case','variants':variants},indent=2))
