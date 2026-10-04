import ctypes as C,os,json,pathlib
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so');P=C.c_void_p
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p];L.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P];L.sqlite3_close.argtypes=[P];L.sqlite3_sourceid.restype=C.c_char_p
out=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 name='row-width-unsupported-collation-'+enc.lower().replace('-','')+'.db';path=pathlib.Path('test/conformance/fixtures')/name
 if path.exists():path.unlink()
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 sql=f"PRAGMA encoding='{enc}';CREATE TABLE q(a CHAR(100),b INTEGER);CREATE INDEX qi ON q(a COLLATE nocase);INSERT INTO q VALUES('A',1);PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql=replace(sql,'nocase','custom') WHERE name='qi';"
 assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0;assert L.sqlite3_close(db)==0
 out.append(dict(encoding=enc,fixture=str(path),bytes=path.stat().st_size))
print(json.dumps(dict(sourceId=L.sqlite3_sourceid().decode(),variants=out),indent=2))
