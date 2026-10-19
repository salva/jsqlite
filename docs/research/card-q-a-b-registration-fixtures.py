# Development-only corrupted-schema fixture for native/TS registration checks.
# Ordinary rows are rewritten then reopened; never used by the runtime.
import ctypes as C, pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_sourceid',[],C.c_char_p)]:
 f=getattr(L,n);f.argtypes=a;f.restype=r
print(L.sqlite3_sourceid().decode())
root=pathlib.Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
expressions=['CURRENT_TIMESTAMP','sqlite_version()','random()',"CASE WHEN 1 THEN 'ok' ELSE CURRENT_TIME END","datetime('2000-01-01')"]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 for i,expression in enumerate(expressions):
  p=root/f'{encoding}-{i}.db';p.unlink(missing_ok=True);db=P();assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
  def run(sql):
   e=C.c_char_p();rc=L.sqlite3_exec(db,sql.encode(),None,None,C.byref(e));return rc,e.value.decode() if e.value else 'ok'
  assert run(f"PRAGMA encoding='{encoding}';CREATE TABLE t(a);INSERT INTO t VALUES('x')")[0]==0
  definition=f'CREATE TABLE t(a,g AS ({expression}) VIRTUAL)'.replace("'","''")
  assert run(f"PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='{definition}' WHERE name='t';PRAGMA writable_schema=OFF")[0]==0
  L.sqlite3_close(db);assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
  rc,msg=run('SELECT g FROM t');print(encoding,i,rc,msg);assert rc==(0 if i==4 else 11)
  L.sqlite3_close(db)
