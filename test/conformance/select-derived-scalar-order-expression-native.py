#!/usr/bin/env python3
"""Pinned public derived scalar expression ORDER oracle."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:f=getattr(L,n);f.argtypes=args;f.restype=ret
root=pathlib.Path(__file__).resolve().parents[2];assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];path=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db';db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
cases=[('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1) d',[(7,)]),('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1 LIMIT 0) d',[]),('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1 LIMIT 2 OFFSET 1) d',[]),('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1 DESC) d',[(7,)]),('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1 LIMIT 1 OFFSET 0) d',[(7,)]),('SELECT d.n FROM (SELECT 7 AS n ORDER BY n+1 LIMIT 0) d',[])]
try:
 for sql,want in cases:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  try:
   for _ in range(2):
    got=[]
    while (rc:=L.sqlite3_step(st))==100:got.append((None if L.sqlite3_column_type(st,0)==5 else L.sqlite3_column_int64(st,0),))
    assert rc==101 and got==want,(sql,got,want)
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
finally:assert L.sqlite3_close(db)==0
print('pinned scalar expression ORDER derived: 6 typed cases x2 reset')
