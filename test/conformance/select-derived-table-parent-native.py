#!/usr/bin/env python3
"""Pinned public C oracle: admitted table-backed FROM coroutine, select.c tag-select-0482."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db'
db=P();assert L.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 for sql,names,rows in [(b'SELECT d.a FROM (SELECT a FROM t1 LIMIT 2 OFFSET 1) d LIMIT 1 OFFSET 1',[b'a'],[5]),(b'SELECT * FROM (SELECT a FROM t1 LIMIT 0) d',[b'a'],[]),(b'SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 ORDER BY x) d',[b'x'],[1]),(b'SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 HAVING count(*)>1 ORDER BY x) d',[b'x'],[1]),(b'SELECT d.n FROM (SELECT count(*) AS n FROM t1 WHERE a>2 LIMIT 1) d',[b'n'],[3]),(b'SELECT d.n FROM (SELECT count(*) AS n FROM t1 HAVING count(*)>9 LIMIT 1) d',[b'n'],[]),(b'SELECT d.x FROM (SELECT DISTINCT a%2 AS x FROM t1) d',[b'x'],[1]),(b'SELECT d.a FROM (SELECT a FROM t1 ORDER BY a LIMIT 2 OFFSET 1) d',[b'a'],[3,5]),(b'SELECT d.a FROM (SELECT a FROM t1 ORDER BY -a LIMIT 2) d',[b'a'],[7,5])]:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(s)==len(names) and [L.sqlite3_column_name(s,i) for i in range(len(names))]==names
   for _ in range(2):
    got=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100,(sql,rc,L.sqlite3_errmsg(db))
     assert L.sqlite3_column_type(s,0)==1
     got.append(L.sqlite3_column_int64(s,0))
    assert got==rows,(sql,got)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 bad=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT a FROM t1 LIMIT 2) d',-1,C.byref(bad),None)==1
 assert not bad.value and b'no such column' in L.sqlite3_errmsg(db)
 print('pinned table-derived coroutine rows/type/names/limits/reset/error/finalize OK')
finally:assert L.sqlite3_close(db)==0
