#!/usr/bin/env python3
"""Bounded native-first generated-date admission diagnostic; output stays card work."""
import ctypes as C, pathlib, sys
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for n,a,r in [('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p)]:
 f=getattr(L,n);f.argtypes=a;f.restype=r
print('source',L.sqlite3_sourceid().decode())
p=pathlib.Path(sys.argv[2]);p.unlink(missing_ok=True);db=P();assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
def execute(sql):
 e=C.c_char_p();rc=L.sqlite3_exec(db,sql.encode(),None,None,C.byref(e));assert rc==0,(rc,e.value)
# Build physical rows without evaluating generated expressions. Native schema
# reload then evaluates ordinary, legal conditional-deterministic date definitions.
execute("CREATE TABLE t(a TEXT);INSERT INTO t VALUES('now');CREATE TABLE literal(a TEXT);INSERT INTO literal VALUES('x');PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='CREATE TABLE t(a TEXT,g TEXT AS (datetime(a)) VIRTUAL)' WHERE name='t';UPDATE sqlite_schema SET sql='CREATE TABLE literal(a TEXT,g TEXT AS (datetime(''2000-01-01'')) VIRTUAL)' WHERE name='literal';PRAGMA writable_schema=OFF;")
L.sqlite3_close(db);assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
for sql in ['SELECT g FROM literal','SELECT g FROM t','SELECT datetime(\'2000-01-01\')']:
 s=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None);print(sql,'prepare',rc)
 if rc==0:
  rc=L.sqlite3_step(s);print('step',rc,'text' if rc==100 else 'error',(L.sqlite3_column_text(s,0) if rc==100 else L.sqlite3_errmsg(db)).decode());L.sqlite3_finalize(s)
L.sqlite3_close(db)
