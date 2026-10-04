# Development-only pinned stat1 callback oracle. Writable construction only;
# product runtime opens immutable snapshots and never imports this script.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
L.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P]
L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),P]
L.sqlite3_step.argtypes=[P];L.sqlite3_finalize.argtypes=[P];L.sqlite3_close.argtypes=[P]
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
L.sqlite3_column_int64.argtypes=[P,C.c_int];L.sqlite3_column_int64.restype=C.c_longlong
L.sqlite3_sourceid.restype=C.c_char_p
out={'sourceId':L.sqlite3_sourceid().decode(),'variants':[]}
for enc in ['UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-invalid-utf16-'+enc.lower()+'.db');path.unlink(missing_ok=True)
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 def exec(sql):assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0,sql
 exec("PRAGMA encoding='"+enc+"'; CREATE TABLE é(k TEXT PRIMARY KEY,v BLOB(1000)); CREATE TABLE u(k TEXT UNIQUE,v BLOB(1000)); INSERT INTO u VALUES('é',x'ff'); INSERT INTO é VALUES('é',x'ff'),('A',x'00'); ANALYZE;")
 # Callback uses database encoding for BLOB values, then UTF-8/NUL termination.
 codec={'UTF-8':'utf-8','UTF-16le':'utf-16le','UTF-16be':'utf-16be'}[enc]
 def blob(s):return "x'"+s.encode(codec).hex()+"'"
 raw='1000 2 '.encode(codec)+(b'\x00\xd8' if enc=='UTF-16le' else b'\xd8\x00')+' sz=8 unordered'.encode(codec)
 exec("DELETE FROM sqlite_stat1; INSERT INTO sqlite_stat1 VALUES('é','é',x'"+raw.hex()+"'); ANALYZE sqlite_schema;")
 # A malformed UTF8 table name must not alias ASCII p via READ_UTF8.
 # UTF16 controls use an unknown name (the suffix stat still valid).
 badname=(b'\x00\xdc' if enc=='UTF-16le' else b'\xdc\x00')
 exec("INSERT INTO sqlite_stat1 VALUES(x'"+badname.hex()+"',NULL,'3 sz=128'); ANALYZE sqlite_schema;")
 # sqlite3_exec supplies raw UTF8 callback bytes, not decoded Unicode.
 seen=[]
 CB=C.CFUNCTYPE(C.c_int,P,C.c_int,C.POINTER(C.c_char_p),P)
 @CB
 def callback(ctx,n,values,names):
  seen.append([v.hex() if v is not None else None for v in values[:n]]);return 0
 assert L.sqlite3_exec(db,b'SELECT tbl,idx,stat FROM sqlite_stat1',C.cast(callback,P),None,None)==0

 sql="SELECT k,v FROM é WHERE k='é'"
 st=P();assert L.sqlite3_prepare_v2(db,('EXPLAIN QUERY PLAN '+sql).encode(),-1,C.byref(st),None)==0
 eqp=[]
 while L.sqlite3_step(st)==100:eqp.append(L.sqlite3_column_text(st,3).decode())
 L.sqlite3_finalize(st);L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sql':sql,'eqp':eqp,'callbackHex':seen})
pathlib.Path('test/conformance/cases/row-width-invalid-utf16-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(out)
