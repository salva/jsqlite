#!/usr/bin/env python3
"""Pinned public SQLite zero-source FROM coroutine oracle, select.c tag-select-0482."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name); f.argtypes=args; f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
sqls=[b"SELECT d.i,d.r,d.t,d.b,d.n FROM (SELECT 7 AS i,1.5 AS r,'\xc3\xa9' AS t,x'00ff' AS b,NULL AS n) d",b'SELECT d.i FROM (SELECT 7 AS i WHERE 0) d',b'SELECT d.i FROM (SELECT 7 AS i LIMIT 0 OFFSET 1) d',b'SELECT d.i FROM (SELECT 7 AS i LIMIT 1 OFFSET 1) d']
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 for sql in sqls:
  st=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(st),None)==0,L.sqlite3_errmsg(db)
  try:
   for _ in range(2):
    if sql==sqls[0]:
     assert L.sqlite3_step(st)==100
     assert [L.sqlite3_column_type(st,i) for i in range(5)]==[1,2,3,4,5]
     assert L.sqlite3_column_int64(st,0)==7 and L.sqlite3_column_double(st,1)==1.5
     assert C.string_at(L.sqlite3_column_text(st,2),L.sqlite3_column_bytes(st,2))==b'\xc3\xa9'
     assert C.string_at(L.sqlite3_column_blob(st,3),L.sqlite3_column_bytes(st,3))==b'\x00\xff'
    assert L.sqlite3_step(st)==101
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
 bad=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT 7 AS i) d',-1,C.byref(bad),None)==1
 assert not bad.value
finally:assert L.sqlite3_close(db)==0
print('pinned scalar coroutine oracle: 4 typed/reset cases + prepare error')
