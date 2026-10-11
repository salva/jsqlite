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

path=out/'wherei-expanded.db';path.unlink(missing_ok=True);db=ptr();assert op(str(path).encode(),C.byref(db))==0
cases=[]
try:
 for number,values in [(1,["1","2","3","4"]),(2,["'i'","'ii'","'iii'","'iv'"])]:
  table=f't{number}'
  setup=[f'CREATE TABLE {table}(a, b, c, PRIMARY KEY(a)) WITHOUT ROWID']
  setup += [f"INSERT INTO {table} VALUES({a}, '{b}', '{c}')" for a,b,c in zip(values,'abcd','zyxw')]
  setup += [f'CREATE INDEX i{2*number-1} ON {table}(b)',f'CREATE INDEX i{2*number} ON {table}(c)']
  for q in setup: assert 'error' not in query(db,q)
  for suffix,b,c in [('2','b','x'),('3','a','z')]:
   sql=f"SELECT a FROM {table} WHERE b='{b}' OR c='{c}'"
   cases.append({'id':f'whereI-{number}.{suffix}','sql':sql,'classification':'exact execsql SQL/schema/data; setup whereI-1.0/2.0',**query(db,sql),'eqp':query(db,'EXPLAIN QUERY PLAN '+sql),'explain':query(db,'EXPLAIN '+sql)})
finally: assert close(db)==0
artifact={'sourceId':source().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'upstreamSha256':hashlib.sha256((root/'reference/sqlite/sqlite-src-3530400/test/whereI.test').read_bytes()).hexdigest(),'fixture':{'path':'test/fixtures/wr-wherei-expanded.db','sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'classification':'four additional exact execsql cases; eqp1.1/2.1 retained as oracle diagnostics, not independent case credit; one UTF-8 fixture','cases':cases}
print(json.dumps(artifact,indent=2))
