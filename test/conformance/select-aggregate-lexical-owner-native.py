#!/usr/bin/env python3
"""Pinned select.c derived compound/join producer red discriminator."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,restype in [
 ('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),
 ('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),
 ('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),
]:
 f=getattr(L,name);f.argtypes=args;f.restype=restype
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=str(root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db').encode()

db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
expected=[[[1,None],[3,None],[5,None],[7,None]],[[1,2.0],[3,4.0],[5,6.0],[7,8.0]],[[1,17]],[[1,2],[3,4],[5,6],[7,8]],[[1,16]],[[1,20],[3,28],[5,36],[7,44]],[[1,1],[3,3],[5,5],[7,7]],[[1,None],[3,None],[5,None],[7,None]],[[1,1.0],[3,3.0],[5,5.0],[7,7.0]]]
for index,sql in enumerate(["SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u WHERE NULL) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT CASE WHEN sum(t.a)>0 THEN sum(CAST(t.a AS REAL))+1 ELSE abs(-9223372036854775808) END FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u) AS s FROM t1 t ORDER BY t.a", "SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT sum(t.a) FROM t1 u) AS s FROM t1 t ORDER BY t.a", "SELECT t.a,(SELECT sum(u.a+t.a) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT sum(t.a) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT sum(t.a) FROM t1 u WHERE NULL) AS s FROM t1 t GROUP BY t.a ORDER BY t.a", "SELECT t.a,(SELECT sum(CAST(t.a AS REAL)) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a"]):
 st=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);print(sql,'prepare',rc,L.sqlite3_errmsg(db).decode());rows=[]
 assert rc==0
 if rc==0:
  while L.sqlite3_step(st)==100:
   rows.append([(L.sqlite3_column_type(st,i), None if L.sqlite3_column_type(st,i)==5 else L.sqlite3_column_double(st,i) if L.sqlite3_column_type(st,i)==2 else L.sqlite3_column_int64(st,i)) for i in range(L.sqlite3_column_count(st))])
  assert rows==[[(5 if value is None else 2 if isinstance(value,float) else 1,value) for value in row] for row in expected[index]], rows
  print(rows);L.sqlite3_finalize(st)
L.sqlite3_close(db)
