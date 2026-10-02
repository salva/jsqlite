#!/usr/bin/env python3
"""Pinned select.c derived compound/join producer red discriminator."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,restype in [
 ('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
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
for sql in [
 'SELECT sum(missing) FROM (SELECT x FROM t2 UNION ALL SELECT NULL) d LIMIT 0',
 'SELECT sum(d.missing) FROM (SELECT x FROM t2 UNION ALL SELECT NULL) d LIMIT 0',
 'SELECT d.x FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a',
 'SELECT d.x FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a LIMIT 0',
]:
 stmt=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)
 if 'missing' in sql:
  assert rc==1 and ('no such column: d.missing' if 'd.missing' in sql else 'no such column: missing') in L.sqlite3_errmsg(db).decode(),(sql,rc,L.sqlite3_errmsg(db))
 else:assert rc==0,(sql,rc,L.sqlite3_errmsg(db))
 print(sql,rc,L.sqlite3_errmsg(db).decode())
 if stmt:L.sqlite3_finalize(stmt)
assert L.sqlite3_close(db)==0

db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
for suffix in ['', ' LIMIT 0', ' LIMIT 3 OFFSET 2', ' LIMIT -1 OFFSET 6']:
 sql='SELECT d.x,t.a FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a'+suffix
 stmt=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
 rows=[]
 while True:
  rc=L.sqlite3_step(stmt)
  if rc!=100:break
  assert all(L.sqlite3_column_type(stmt,i)==1 for i in range(2))
  rows.append([L.sqlite3_column_int64(stmt,i) for i in range(2)])
 assert rc==101
 expected={'':[[1,1],[1,1],[1,3],[1,3],[1,5],[1,5],[1,7],[1,7]],' LIMIT 0':[],' LIMIT 3 OFFSET 2':[[1,3],[1,3],[1,5]],' LIMIT -1 OFFSET 6':[[1,7],[1,7]]}[suffix]
 assert rows==expected,(sql,rows,expected)
 print(sql,rows)
 assert L.sqlite3_finalize(stmt)==0
assert L.sqlite3_close(db)==0

db=P();assert L.sqlite3_open(fixture,C.byref(db))==0
stmt=P();sql='SELECT d.x,t.a FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t LIMIT 3 OFFSET 2'
assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
rows=[]
while True:
 rc=L.sqlite3_step(stmt)
 if rc!=100:break
 assert all(L.sqlite3_column_type(stmt,i)==1 for i in range(2))
 rows.append([L.sqlite3_column_int64(stmt,i) for i in range(2)])
assert rc==101 and rows==[[1,5],[1,7],[1,1]],rows
print(sql,rows)
assert L.sqlite3_finalize(stmt)==0 and L.sqlite3_close(db)==0
