#!/usr/bin/env python3
"""Pinned public ordered joined UNION ALL derived oracle."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:f=getattr(L,n);f.argtypes=args;f.restype=ret
root=pathlib.Path(__file__).resolve().parents[2];assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];path=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db'
db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
cases=[('SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 UNION ALL SELECT x.a,y.a FROM t1 x LEFT JOIN t1 y ON y.a=x.a+2 WHERE x.a<4 ORDER BY 1) d',[(1,1),(1,3),(3,3),(3,5)]),('SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 UNION ALL SELECT x.a,y.a FROM t1 x LEFT JOIN t1 y ON y.a=x.a+2 WHERE x.a<4 ORDER BY 1) d ORDER BY 1',[(1,1),(1,3),(3,3),(3,5)]),('SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 UNION ALL SELECT x.a,y.a FROM t1 x LEFT JOIN t1 y ON y.a=x.a+2 WHERE x.a<4 ORDER BY 1) d ORDER BY 1 DESC',[(3,3),(3,5),(1,1),(1,3)])]
try:
 for sql,want in cases:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  try:
   for _ in range(2):
    got=[]
    while (rc:=L.sqlite3_step(st))==100:got.append(tuple(None if L.sqlite3_column_type(st,i)==5 else L.sqlite3_column_int64(st,i) for i in range(2)))
    assert rc==101 and got==want,(sql,got,want)
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
finally:assert L.sqlite3_close(db)==0
print('pinned ordered joined UNION ALL derived: 3 typed cases x2 reset')
