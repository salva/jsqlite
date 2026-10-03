#!/usr/bin/env python3
"""Pinned public recursive producer composition oracle (source-ID checked)."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
lib=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,result in [
 ('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),
 ('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),
 ('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=result
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
sql=("WITH RECURSIVE a(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM a WHERE x<2), "
     "b(y) AS (VALUES(10) UNION ALL SELECT y+10 FROM b WHERE y<20) "
     "SELECT x,y FROM a,b ORDER BY y DESC,x")
expected=[[(1,1),(1,20)],[(1,2),(1,20)],[(1,1),(1,10)],[(1,2),(1,10)]]
db=P();assert lib.sqlite3_open(b':memory:',C.byref(db))==0
stmt=P()
try:
 assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
 assert lib.sqlite3_column_count(stmt)==2
 for _ in range(2):
  rows=[]
  while True:
   rc=lib.sqlite3_step(stmt)
   if rc==101:break
   assert rc==100,rc
   rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i)) for i in range(2)])
  assert rows==expected,rows
  assert lib.sqlite3_reset(stmt)==0
 print('recursive cross join (type,value), two executions:',expected)
finally:
 if stmt:assert lib.sqlite3_finalize(stmt)==0
 assert lib.sqlite3_close(db)==0

# Shared parent ParameterBuilder must preserve independent producer indices.
lib.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_longlong];lib.sqlite3_bind_int64.restype=C.c_int
sql="WITH RECURSIVE a(x) AS (VALUES(?1) UNION ALL SELECT x+1 FROM a WHERE x<2), b(y) AS (VALUES(?2) UNION ALL SELECT y+10 FROM b WHERE y<20) SELECT x,y FROM a,b ORDER BY y DESC,x"
db=P();assert lib.sqlite3_open(b':memory:',C.byref(db))==0
stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
try:
 for first,second,want in [(1,10,expected),(2,20,[[(1,2),(1,20)]])]:
  assert lib.sqlite3_bind_int64(stmt,1,first)==0;assert lib.sqlite3_bind_int64(stmt,2,second)==0
  rows=[]
  while True:
   rc=lib.sqlite3_step(stmt)
   if rc==101:break
   assert rc==100
   rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i)) for i in range(2)])
  assert rows==want,(rows,want)
  assert lib.sqlite3_reset(stmt)==0
finally:
 lib.sqlite3_finalize(stmt);lib.sqlite3_close(db)
print('independent producer bindings and reset pass')
