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
cases=[('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a>1 GROUP BY t.a HAVING s>2 ORDER BY k', ['k', 's'], [[3, 3], [5, 5], [7, 7]]), ('SELECT CAST(t.a AS REAL) AS k,sum(CAST(t.a AS REAL)) AS s FROM t1 t WHERE CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END GROUP BY t.a ORDER BY k', ['k', 's'], [[1.0, 1.0], [3.0, 3.0], [5.0, 5.0], [7.0, 7.0]]), ('SELECT t.a AS a,count(DISTINCT t.a) AS n,sum(t.a) FILTER (WHERE t.a<5) AS s FROM t1 t WHERE t.a>0 GROUP BY t.a ORDER BY a', ['a', 'n', 's'], [[1, 1, 1], [3, 1, 3], [5, 1, None], [7, 1, None]]), ('SELECT min(t.a-t.a) AS m,t.a AS a FROM t1 t WHERE t.a>1 GROUP BY t.a-t.a ORDER BY m', ['m', 'a'], [[0, 3]]), ('SELECT sum(t.a) AS s FROM t1 t WHERE NULL GROUP BY t.a', ['s'], [])]
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
   got.append([(L.sqlite3_column_type(stmt,i),(None if L.sqlite3_column_type(stmt,i)==5 else L.sqlite3_column_double(stmt,i) if L.sqlite3_column_type(stmt,i)==2 else L.sqlite3_column_int64(stmt,i))) for i in range(len(names))])
  assert got==[[(5 if value is None else 2 if isinstance(value,float) else 1,value) for value in row] for row in rows],(sql,got)
  print(sql,got)
 finally:
  if stmt:L.sqlite3_finalize(stmt)
  assert L.sqlite3_close(db)==0
db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
for expression in ['missing','sum(sum(t.a))']:
 stmt=P();sql=f'SELECT sum({expression}) FROM t1 t LIMIT 0'
 rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)
 assert rc==1 and ('no such column: missing' if expression=='missing' else 'misuse of aggregate function sum()') in L.sqlite3_errmsg(db).decode(),(sql,rc,L.sqlite3_errmsg(db))
 print(sql,L.sqlite3_errmsg(db).decode())
assert L.sqlite3_close(db)==0
