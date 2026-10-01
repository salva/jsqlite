#!/usr/bin/env python3
"""Pinned scalar correlated NameContext over a UNION ALL derived aggregate."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db'
lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=result
assert lib.sqlite3_sourceid().decode()==source
cases=[
 ('SELECT t.a,(SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d WHERE d.x=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',['a','n'],[[(1,1),(1,1)],[(1,3),(1,0)]]),
 ('SELECT t.a,(SELECT sum(d.x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d WHERE d.x=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',['a','n'],[[(1,1),(1,1)],[(1,3),(5,None)]]),
 ('SELECT t.a,(SELECT count(*) FROM t1 i WHERE i.a=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',['a','n'],[[(1,1),(1,1)],[(1,3),(1,1)]])
]
db=P();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 for sql,names,expected in cases:
  stmt=P()
  try:
   assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,sql
   assert [lib.sqlite3_column_name(stmt,i).decode() for i in range(lib.sqlite3_column_count(stmt))]==names
   for _ in range(2):
    rows=[]
    while True:
     rc=lib.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100,(sql,rc)
     rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i) if lib.sqlite3_column_type(stmt,i)!=5 else None) for i in range(2)])
    assert rows==expected,(sql,rows)
    assert lib.sqlite3_reset(stmt)==0
   print('scalar linked NameContext:',rows)
  finally:
   if stmt:assert lib.sqlite3_finalize(stmt)==0
finally:assert lib.sqlite3_close(db)==0
