#!/usr/bin/env python3
"""Pinned select.c derived compound/join producer red discriminator."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,restype in [
 ('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),
 ('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),
 ('sqlite3_column_decltype',[P,C.c_int],C.c_char_p),('sqlite3_column_database_name',[P,C.c_int],C.c_char_p),('sqlite3_column_table_name',[P,C.c_int],C.c_char_p),('sqlite3_column_origin_name',[P,C.c_int],C.c_char_p),
 ('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),
]:
 f=getattr(L,name);f.argtypes=args;f.restype=restype
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=str(root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db').encode()
cases=[
 ('WITH c AS MATERIALIZED (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 LIMIT 2) SELECT l.r FROM c l JOIN c r ON (l.r)=(r.r) ORDER BY 1',['r'],[[1],[2]]),
 ('WITH c AS MATERIALIZED (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) SELECT r FROM c ORDER BY 1',['r'],[[1],[2],[3],[4]]),
 ('WITH c AS MATERIALIZED (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 LIMIT 0) SELECT r FROM c ORDER BY 1',['r'],[]),
 ('WITH c AS MATERIALIZED (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 LIMIT 2 OFFSET 1) SELECT l.r FROM c l CROSS JOIN c r ORDER BY 1',['r'],[[2],[2],[3],[3]]),
 ('WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 2) SELECT x AS y FROM c ORDER BY 1',['y'],[[1],[1]]),
 ('WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 0) SELECT x AS y FROM c ORDER BY 1',['y'],[]),
 ('WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 1 OFFSET 2) SELECT x AS y FROM c ORDER BY 1',['y'],[[3]]),
 ('WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 2) SELECT l.x AS y FROM c l CROSS JOIN c r ORDER BY 1',['y'],[[1],[1],[1],[1]]),
]
for sql,names,rows in cases:
 db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
 stmt=P()
 try:
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,sql
  assert [L.sqlite3_column_name(stmt,i).decode() for i in range(L.sqlite3_column_count(stmt))]==names
  if 'row_number()' in sql:
   assert [L.sqlite3_column_decltype(stmt,0),L.sqlite3_column_database_name(stmt,0),L.sqlite3_column_table_name(stmt,0),L.sqlite3_column_origin_name(stmt,0)]==[None]*4
  got=[]
  while True:
   rc=L.sqlite3_step(stmt)
   if rc==101:break
   assert rc==100,(sql,rc)
   got.append([(L.sqlite3_column_type(stmt,i),L.sqlite3_column_int64(stmt,i)) for i in range(len(names))])
  assert got==[[(1,value) for value in row] for row in rows],(sql,got)
  print(sql,got)
 finally:
  if stmt:L.sqlite3_finalize(stmt)
  assert L.sqlite3_close(db)==0

db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
stmt=P()
try:
 assert L.sqlite3_prepare_v2(db,b'WITH c AS MATERIALIZED (SELECT missing AS x FROM t2 LIMIT 0) SELECT x FROM c ORDER BY 1',-1,C.byref(stmt),None)==1
 assert L.sqlite3_prepare_v2(db,b'WITH c AS MATERIALIZED (SELECT row_number() OVER (ORDER BY missing) AS x FROM t2 LIMIT 0) SELECT x FROM c ORDER BY 1',-1,C.byref(stmt),None)==1
finally:
 if stmt:L.sqlite3_finalize(stmt)
 L.sqlite3_close(db)
