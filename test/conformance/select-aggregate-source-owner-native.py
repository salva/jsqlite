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
cases=[('SELECT d.a,sum(CAST(d.a AS REAL)) FILTER (WHERE d.a<5) FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1) d GROUP BY d.a ORDER BY d.a', ['a', 'sum(CAST(d.a AS REAL)) FILTER (WHERE d.a<5)'], [[1, 2.0], [3, 6.0], [5, None], [7, None]]), ('SELECT d.a AS k,min(d.a),sum(d.a ORDER BY d.a DESC) AS s FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1 WHERE NULL) d WHERE d.a>1 GROUP BY 1 HAVING s>3 ORDER BY s DESC', ['k', 'min(d.a)', 's'], [[7, 7, 7], [5, 5, 5]]), ('SELECT a,sum(a) FROM t1 GROUP BY 1 ORDER BY a', ['a', 'sum(a)'], [[1, 1], [3, 3], [5, 5], [7, 7]]), ('SELECT CAST(a AS REAL) AS k,sum(a) AS s FROM t1 GROUP BY 1 HAVING s>1 ORDER BY k DESC', ['k', 's'], [[7.0, 7], [5.0, 5], [3.0, 3]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a>1 GROUP BY t.a HAVING s>2 ORDER BY k', ['k', 's'], [[3, 3], [5, 5], [7, 7]]), ('SELECT CAST(t.a AS REAL) AS k,sum(CAST(t.a AS REAL)) AS s FROM t1 t WHERE CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END GROUP BY t.a ORDER BY k', ['k', 's'], [[1.0, 1.0], [3.0, 3.0], [5.0, 5.0], [7.0, 7.0]]), ('SELECT t.a AS a,count(DISTINCT t.a) AS n,sum(t.a) FILTER (WHERE t.a<5) AS s FROM t1 t WHERE t.a>0 GROUP BY t.a ORDER BY a', ['a', 'n', 's'], [[1, 1, 1], [3, 1, 3], [5, 1, None], [7, 1, None]]), ('SELECT min(t.a-t.a) AS m,t.a AS a FROM t1 t WHERE t.a>1 GROUP BY t.a-t.a ORDER BY m', ['m', 'a'], [[0, 3]]), ('SELECT sum(t.a) AS s FROM t1 t WHERE NULL GROUP BY t.a', ['s'], []), ('SELECT t.a AS k,sum(u.a) AS s,count(DISTINCT u.a) AS n FROM t1 t LEFT JOIN t1 u ON t.a=u.a AND u.a<5 GROUP BY t.a ORDER BY k', ['k', 's', 'n'], [[1, 1, 1], [3, 3, 1], [5, None, 0], [7, None, 0]]), ('SELECT sum(CAST(u.a AS REAL)) FILTER (WHERE u.a<5) AS s,count(DISTINCT u.a) AS n,min(t.a-t.a) AS m,t.a AS a FROM t1 t JOIN t1 u ON t.a=u.a AND CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END', ['s', 'n', 'm', 'a'], [[4.0, 4, 0, 1]]), ('SELECT min(t.a-t.a) AS m,(t.a BETWEEN 1 AND 3) AS b,(t.a IN (1,3)) AS i,sum(CASE WHEN t.a>0 THEN CAST(t.a AS REAL) ELSE abs(-9223372036854775808) END) AS s FROM t1 t GROUP BY t.a-t.a', ['m', 'b', 'i', 's'], [[0, 1, 1, 16.0]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a AND u.a<5) ORDER BY k', ['k', 's'], [[1, 1], [3, 3]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a AND u.a<5) GROUP BY t.a ORDER BY k', ['k', 's'], [[1, 1], [3, 3]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 t WHERE t.a=1) ORDER BY k', ['k', 's'], [[1, 1], [3, 3], [5, 5], [7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a) ORDER BY k', ['k', 's'], [[1, 1], [3, 3], [5, 5], [7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT u.a FROM t1 u ORDER BY abs(u.a-t.a),u.a LIMIT 1) AS near FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'near'], [[1, 1, 1], [3, 3, 3], [5, 5, 5], [7, 7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a=(SELECT u.a FROM t1 u ORDER BY abs(u.a-t.a),u.a LIMIT 1) GROUP BY t.a ORDER BY k', ['k', 's'], [[1, 1], [3, 3], [5, 5], [7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS prev FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'prev'], [[1, 1, None], [3, 3, 1], [5, 5, 3], [7, 7, 5]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT t.a FROM t1 t ORDER BY t.a DESC LIMIT 1) AS last FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'last'], [[1, 1, 7], [3, 3, 7], [5, 5, 7], [7, 7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(u.a+t.a) FROM t1 u) AS total FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'total'], [[1, 1, 20], [3, 3, 28], [5, 5, 36], [7, 7, 44]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE (SELECT sum(u.a+t.a) FROM t1 u)>25 GROUP BY t.a ORDER BY k', ['k', 's'], [[3, 3], [5, 5], [7, 7]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(CAST(u.a+t.a AS REAL)) FROM t1 u) AS total FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'total'], [[1, 1, 20.0], [3, 3, 28.0], [5, 5, 36.0], [7, 7, 44.0]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(t.a) FROM t1 t) AS total FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'total'], [[1, 1, 16], [3, 3, 16], [5, 5, 16], [7, 7, 16]]), ('SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(CASE WHEN u.a<t.a THEN u.a END) FROM t1 u) AS prev FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'prev'], [[1, 1, None], [3, 3, 1], [5, 5, 4], [7, 7, 9]]), ('SELECT t.a AS k,sum(t.a) AS s,1 IN (SELECT t.a FROM t1 u) AS hit FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'hit'], [[1, 1, 1], [3, 3, 0], [5, 5, 0], [7, 7, 0]]), ('SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE 1 IN (SELECT t.a FROM t1 u) GROUP BY t.a ORDER BY k', ['k', 's'], [[1, 1]]), ('SELECT t.a AS k,sum(t.a) AS s,1 IN (SELECT t.a FROM t1 t) AS hit FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'hit'], [[1, 1, 1], [3, 3, 1], [5, 5, 1], [7, 7, 1]]), ('SELECT t.a AS k,sum(t.a) AS s,NULL IN (SELECT t.a FROM t1 u LIMIT 0) AS hit FROM t1 t GROUP BY t.a ORDER BY k', ['k', 's', 'hit'], [[1, 1, 0], [3, 3, 0], [5, 5, 0], [7, 7, 0]]), ('SELECT t.a AS k,sum(t.a) AS s,1 NOT IN (SELECT u.a FROM t1 v) AS hit FROM t1 t LEFT JOIN t1 u ON u.a=t.a AND u.a<5 GROUP BY t.a ORDER BY k', ['k', 's', 'hit'], [[1, 1, 0], [3, 3, 1], [5, 5, None], [7, 7, None]])]
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
