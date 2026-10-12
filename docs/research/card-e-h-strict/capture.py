import ctypes as C,importlib.util,pathlib,json,os,hashlib
s=importlib.util.spec_from_file_location('n','test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']);d=n.load(str(w/'oracle-build/build/libsqlite3-oracle.so'));pin=json.loads(pathlib.Path('reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];out=[];errors=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=w/'strict-red'/f'{enc}.db';p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 sql=f"PRAGMA encoding='{enc}'; CREATE TABLE t(k TEXT PRIMARY KEY,a ANY,r REAL,g ANY AS (a) VIRTUAL,s ANY AS (a) STORED) STRICT; INSERT INTO t(k,a,r) VALUES('x','000123',7); CREATE INDEX ia ON t(a COLLATE NOCASE);CREATE TABLE pk(i INTEGER PRIMARY KEY,j INT,v ANY) STRICT; INSERT INTO pk VALUES(1,2,X'00ff'),(2,NULL,9223372036854775807),(3,3,NULL);CREATE TABLE ordinary(a ANY);INSERT INTO ordinary VALUES('000123');"
 assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0
 stmt=C.c_void_p();q='SELECT a,g,s,r FROM t';assert d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(stmt),None)==0;assert d.sqlite3_step(stmt)==100
 types=[d.sqlite3_column_type(stmt,i) for i in range(4)];assert types==[3,3,3,2],types;d.sqlite3_finalize(stmt);d.sqlite3_close(db);out.append(dict(encoding=enc,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),sql=q,types=types))
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for name,ddl in [('unknown','CREATE TABLE t(a WAT,b) STRICT'),('missing','CREATE TABLE t(a,b WAT) STRICT'),('malformed','CREATE TABLE t(a INT,) STRICT')]:
  p=w/'strict-red'/f'{name}-{enc}.db';p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
  escaped=ddl.replace("'","''");sql=f"PRAGMA encoding='{enc}';CREATE TABLE t(a INT,b INT);PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='{escaped}' WHERE name='t';"
  assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0;d.sqlite3_close(db);assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,b'SELECT * FROM t',-1,C.byref(st),None);d.sqlite3_errmsg.restype=C.c_char_p;message=d.sqlite3_errmsg(db).decode();assert rc==11,(rc,message);d.sqlite3_finalize(st);d.sqlite3_close(db)
  errors.append(dict(encoding=enc,kind=name,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),message=message,code=rc))
(w/'strict-red/capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],variants=out,errors=errors),indent=2));print(out)
