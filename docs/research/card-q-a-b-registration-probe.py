# Development-only native registration admission, no fixture mutation.
import ctypes as C,sys
lib=C.CDLL(sys.argv[1]);P=C.c_void_p
lib.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(P)];lib.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)];lib.sqlite3_close.argtypes=[P]
db=P();assert lib.sqlite3_open(b':memory:',C.byref(db))==0
for expression in ['CURRENT_TIMESTAMP','sqlite_version()','random()',"CASE WHEN 1 THEN 'ok' ELSE CURRENT_TIME END","datetime('2000-01-01')"]:
 error=C.c_char_p();sql=f'CREATE TABLE t(a TEXT,g TEXT AS ({expression}) VIRTUAL)'
 rc=lib.sqlite3_exec(db,sql.encode(),None,None,C.byref(error));print(expression,rc,error.value.decode() if error.value else 'ok')
 if rc==0:assert lib.sqlite3_exec(db,b'DROP TABLE t',None,None,C.byref(error))==0
lib.sqlite3_close(db)
