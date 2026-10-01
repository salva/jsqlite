#!/usr/bin/env python3
"""Pinned 3.53.4 FROM ordered compound coroutine boundary (select.c tag-select-0482)."""
import ctypes as C, json, pathlib, sys
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 sql=b'SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 2) d ORDER BY 1 LIMIT 1 OFFSET 1'
 stmt=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),None)==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==b'x'
  for _ in range(2):
   assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==2
   assert L.sqlite3_step(stmt)==101
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 bad=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 0) d ORDER BY 1',-1,C.byref(bad),None)==0
 try:assert L.sqlite3_step(bad)==101
 finally:assert L.sqlite3_finalize(bad)==0
 invalid=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 1) d',-1,C.byref(invalid),None)==1
 assert not invalid.value and b'no such column' in L.sqlite3_errmsg(db)
 print('pinned ordered compound coroutine rows/names/limit/reset/error OK')
finally:assert L.sqlite3_close(db)==0
