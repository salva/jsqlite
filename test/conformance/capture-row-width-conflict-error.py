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
L.sqlite3_errmsg.argtypes=[P];L.sqlite3_errmsg.restype=C.c_char_p
out={'sourceId':L.sqlite3_sourceid().decode(),'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-conflict-error-'+enc.lower()+'.db');path.unlink(missing_ok=True)
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 def exec(sql):assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0
 exec("PRAGMA encoding='"+enc+"'; CREATE TABLE p(a TEXT UNIQUE ON CONFLICT IGNORE,b TEXT); INSERT INTO p VALUES('é','payload');")
 exec("PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql='CREATE TABLE p(a TEXT UNIQUE ON CONFLICT IGNORE,b TEXT,UNIQUE(a) ON CONFLICT REPLACE)' WHERE name='p';")
 L.sqlite3_close(db)
 assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 st=P();rc=L.sqlite3_prepare_v2(db,b'SELECT a,b FROM p',-1,C.byref(st),None);msg=L.sqlite3_errmsg(db).decode();L.sqlite3_finalize(st);L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'code':rc,'message':msg})
pathlib.Path('test/conformance/cases/row-width-conflict-error-native.json').write_text(json.dumps(out,indent=2)+'\n');print(out)
