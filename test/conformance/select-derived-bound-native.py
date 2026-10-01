#!/usr/bin/env python3
"""Pinned public bind/reset probe for derived set-prefix and ALL tail."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int)]:
 f=getattr(L,n);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 for sql in [b'SELECT d.i FROM (SELECT ?1 AS i UNION SELECT 2 UNION ALL SELECT ?2) d',b'SELECT d.i FROM (SELECT ?1 AS i EXCEPT SELECT 2 UNION ALL SELECT ?2 LIMIT 2 OFFSET 1) d']:
  st=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(st),None)==0
  try:
   for a,b,want in [(1,3,[1,2,3] if b'EXCEPT' not in sql else [3]),(2,4,[2,4] if b'EXCEPT' not in sql else [])]:
    assert L.sqlite3_bind_int64(st,1,a)==0 and L.sqlite3_bind_int64(st,2,b)==0
    got=[]
    while (rc:=L.sqlite3_step(st))==100:got.append(L.sqlite3_column_int64(st,0))
    assert rc==101 and got==want,(sql,a,b,got,want)
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
finally:assert L.sqlite3_close(db)==0
print('pinned derived bound/reset: 4 typed passes')
