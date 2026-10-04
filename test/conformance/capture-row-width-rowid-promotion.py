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
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-rowid-promotion-'+enc.lower()+'.db');path.unlink(missing_ok=True)
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 def exec(sql):assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0,sql
 exec("PRAGMA encoding='"+enc+"'; CREATE TABLE p(a CHAR(100),b BLOB(1000),c TEXT,UNIQUE(a DESC),PRIMARY KEY(a ASC)); INSERT INTO p VALUES('é',x'ff','payload'),('A',x'00','other'); ANALYZE;")

 sql="SELECT a,b,c FROM p INDEXED BY sqlite_autoindex_p_1 WHERE a='é'"
 directions=[]
 st=P();assert L.sqlite3_prepare_v2(db,b"PRAGMA index_xinfo(sqlite_autoindex_p_1)",-1,C.byref(st),None)==0
 while L.sqlite3_step(st)==100:directions.append(L.sqlite3_column_int64(st,3))
 L.sqlite3_finalize(st)
 expected=[]
 st=P();assert L.sqlite3_prepare_v2(db,b"SELECT a,hex(b),c FROM p INDEXED BY sqlite_autoindex_p_1 WHERE a='\xc3\xa9'",-1,C.byref(st),None)==0
 while L.sqlite3_step(st)==100:expected.append([L.sqlite3_column_text(st,i).decode() for i in range(3)])
 L.sqlite3_finalize(st)
 st=P();assert L.sqlite3_prepare_v2(db,('EXPLAIN QUERY PLAN '+sql).encode(),-1,C.byref(st),None)==0
 eqp=[]
 while L.sqlite3_step(st)==100:eqp.append(L.sqlite3_column_text(st,3).decode())
 L.sqlite3_finalize(st);L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sql':sql,'eqp':eqp,'expected':expected,'directions':directions})
pathlib.Path('test/conformance/cases/row-width-rowid-promotion-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(out)
