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
cases=[('SELECT t.a AS a,count(*) FILTER (WHERE t.a IN (1,3)) OVER (ORDER BY t.a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) AS n FROM t1 t WHERE t.a BETWEEN 1 AND 5 COLLATE BINARY ORDER BY 1', ['a', 'n'], [[1, 0], [3, 1], [5, 2]]), ('SELECT t.a AS a,sum(t.a) FILTER (WHERE NULL) OVER (ORDER BY t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1', ['a', 'n'], [[1, None], [3, None]]), ('SELECT t.a AS a,count(*) OVER (ORDER BY t.a) AS n FROM t1 t WHERE NULL ORDER BY 1 LIMIT 1', ['a', 'n'], [])]
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
  sql=f'SELECT t.a,count(*) FILTER (WHERE t.a>1) OVER (ORDER BY t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a WHERE {projection}>0 LIMIT 0'
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==1
 finally:
  if stmt:L.sqlite3_finalize(stmt)
  L.sqlite3_close(db)
