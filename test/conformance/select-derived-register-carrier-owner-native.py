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
 ('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),
]:
 f=getattr(L,name);f.argtypes=args;f.restype=restype
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=str(root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db').encode()
cases=[("SELECT t.a AS a,(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1 LIMIT 0",["a","n"],[]),('SELECT t.a AS a,(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT 1 UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1', ['a', 'n'], [[1, 2], [3, 0], [5, 0], [7, 0]]), ('SELECT t.a AS a,(SELECT sum(d.x) FROM (SELECT NULL AS x UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1', ['a', 'n'], [[1, None], [3, None], [5, None], [7, None]])]
for sql,names,rows in cases:
 db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
 stmt=P()
 try:
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,sql
  assert [L.sqlite3_column_name(stmt,i).decode() for i in range(L.sqlite3_column_count(stmt))]==names
  got=[]
  while True:
   rc=L.sqlite3_step(stmt)
   if rc==101:break
   assert rc==100,(sql,rc)
   got.append([(L.sqlite3_column_type(stmt,i),(None if L.sqlite3_column_type(stmt,i)==5 else L.sqlite3_column_int64(stmt,i))) for i in range(len(names))])
  assert got==[[(5 if value is None else 1,value) for value in row] for row in rows],(sql,got)
  print(sql,got)
 finally:
  if stmt:L.sqlite3_finalize(stmt)
  assert L.sqlite3_close(db)==0

for projection in ['missing','a']:
 db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
 stmt=P()
 try:
  sql=f'SELECT {projection},(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT NULL) d WHERE d.x=t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a LIMIT 0'
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==1
 finally:
  if stmt:L.sqlite3_finalize(stmt)
  L.sqlite3_close(db)
