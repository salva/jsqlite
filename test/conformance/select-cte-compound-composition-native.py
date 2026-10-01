#!/usr/bin/env python3
"""Pinned 3.53.4 multiSelect / materialized CteUse composition discriminator."""
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
 ('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),
 ('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),
 ('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=result
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
sql=("WITH a AS MATERIALIZED (SELECT 1 AS x UNION ALL SELECT 2), "
     "b AS MATERIALIZED (SELECT 10 AS y UNION ALL SELECT 20) "
     "SELECT a.x,b.y FROM a JOIN b ON a.x=2 ORDER BY 1,2")
db=P();assert lib.sqlite3_open(b':memory:',C.byref(db))==0
stmt=P()
try:
 assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
 assert [lib.sqlite3_column_name(stmt,i).decode() for i in range(lib.sqlite3_column_count(stmt))]==['x','y']
 for _ in range(2):
  rows=[]
  while True:
   rc=lib.sqlite3_step(stmt)
   if rc==101:break
   assert rc==100,rc
   rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i)) for i in range(2)])
  assert rows==[[(1,2),(1,10)],[(1,2),(1,20)]],rows
  assert lib.sqlite3_reset(stmt)==0
 print('materialized compound CTE join:',rows)
finally:
 if stmt:assert lib.sqlite3_finalize(stmt)==0
 assert lib.sqlite3_close(db)==0
