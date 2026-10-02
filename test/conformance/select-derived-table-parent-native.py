#!/usr/bin/env python3
"""Pinned public C oracle: admitted table-backed FROM coroutine, select.c tag-select-0482."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
for name in ['sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']:
 f=getattr(L,name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db'
db=P();assert L.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
 for sql,expected in [
  (b"SELECT 'a' COLLATE nocase AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' ORDER BY 1",[b'a',b'B']),
  (b"SELECT 'a' AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' COLLATE nocase ORDER BY 1",[b'a',b'B']),
  (b"SELECT 'a' COLLATE nocase AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' ORDER BY 1 COLLATE binary",[b'B',b'a']),
 ]:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  assert L.sqlite3_column_name(s,0)==b'x'
  for cycle in range(2):
   got=[]
   while True:
    rc=L.sqlite3_step(s)
    if rc==101:break
    assert rc==100,L.sqlite3_errmsg(db)
    assert L.sqlite3_column_type(s,0)==3
    got.append(L.sqlite3_column_text(s,0))
   assert got==expected,(sql,got,expected)
   assert L.sqlite3_reset(s)==0
  assert L.sqlite3_finalize(s)==0
 for sql,table,origin in [(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2) d LIMIT 8',b't2',b'x'),(b'SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x) d LIMIT 8',b't2',b'x'),(b'SELECT d.x FROM (SELECT a AS x FROM t1 GROUP BY a UNION ALL SELECT x FROM t2) d LIMIT 8',b't2',b'x'),(b'SELECT d.x FROM (SELECT a AS x FROM t1 UNION ALL SELECT x AS other FROM t2) d LIMIT 8',b't2',b'x'),(b'SELECT d.x FROM (SELECT a AS x FROM t1 UNION SELECT x AS other FROM t2) d LIMIT 8',b't2',b'x'),(b'SELECT a AS x FROM t1 UNION ALL SELECT x AS other FROM t2',b't1',b'a'),(b'SELECT a AS x FROM t1 UNION SELECT x AS other FROM t2',b't1',b'a')]:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0
  try:
   assert L.sqlite3_column_name(s,0)==b'x'
   metadata=[getattr(L,name)(s,0) for name in ['sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']]
   assert metadata==[b'INTEGER',b'main',table,origin],metadata
  finally: assert L.sqlite3_finalize(s)==0
 for sql,names,rows in [(b'SELECT d.a FROM (SELECT a FROM t1 LIMIT 2 OFFSET 1) d LIMIT 1 OFFSET 1',[b'a'],[5]),(b'SELECT * FROM (SELECT a FROM t1 LIMIT 0) d',[b'a'],[]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT 0) d',[b'x'],[]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT -1 OFFSET 2) d',[b'x'],[8]),(b'SELECT d.x FROM (SELECT 8 AS x UNION ALL SELECT x FROM t2 WHERE x>1 LIMIT 2 OFFSET 1) d',[b'x'],[3,9]),(b'SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 UNION ALL SELECT 8 LIMIT 1 OFFSET 1) d',[b'x'],[8]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT 2 OFFSET 1) d LIMIT 1',[b'x'],[9]),(b'SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 UNION ALL SELECT DISTINCT 4) d',[b'x'],[4,4]),(b'SELECT d.x FROM (SELECT DISTINCT 8 AS x UNION ALL SELECT DISTINCT 4 FROM t2) d',[b'x'],[8,4]),(b'SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 WHERE 0 UNION ALL SELECT DISTINCT 8) d LIMIT 0',[b'x'],[]),(b'SELECT d.x FROM (SELECT DISTINCT x FROM t2 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1',[b'x'],[3,9]),(b'SELECT sum(d.x) AS s FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d',[b's'],[20]),(b'SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8 WHERE 0) d',[b'n'],[0]),(b'SELECT count(d.x) AS n FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2) d',[b'n'],[8]),(b'SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d',[b'n'],[3]),(b'SELECT d.x FROM (SELECT 8 AS x UNION ALL SELECT x FROM t2 WHERE x>1) d LIMIT 2 OFFSET 1',[b'x'],[3,9]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8) d LIMIT 2',[b'x'],[8]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d LIMIT 0',[b'x'],[]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1',[b'x'],[9,8]),(b'SELECT d.x FROM (SELECT t2.x AS x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT 9 ORDER BY 1) d LIMIT 2 OFFSET 1',[b'x'],[1,3]),(b'SELECT DISTINCT x FROM t2 UNION ALL SELECT 9 ORDER BY 1',[b'x'],[1,3,9,9]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT DISTINCT x FROM t2 ORDER BY 1',[b'x'],[1,1,1,3,3,9]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) HAVING NULL ORDER BY 1',[b'x'],[1,1,3]),(b'SELECT x FROM t2 GROUP BY x HAVING 0 UNION ALL SELECT 9 ORDER BY 1',[b'x'],[9]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) HAVING 0 ORDER BY 1',[b'x'],[1,1,3]),(b'SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT 9 ORDER BY 1',[b'x'],[3,9,9]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) ORDER BY 1',[b'x'],[1,1,1,3]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL VALUES (4),(5) UNION ALL SELECT 9 ORDER BY 1',[b'x'],[1,1,3,4,5,9]),(b'SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT 9 ORDER BY 1',[b'x'],[1,1,3,9]),(b'SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x) d LIMIT 8',[b'x'],[1,1,3,9,1,3,9]),(b'SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 1 OFFSET 1) d LIMIT 2',[b'x'],[3]),(b'SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 0) d LIMIT 2',[b'x'],[]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2 LIMIT 4 OFFSET 2) d LIMIT 3',[b'x'],[9,1,1]),(b'SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 2) d LIMIT 5',[b'x'],[1,1]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING 0 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 1 OFFSET 1) d LIMIT 2',[b'x'],[3]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 0) d LIMIT 2',[b'x'],[]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 3 OFFSET 1) d LIMIT 2',[b'x'],[9,1]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2) d LIMIT 8',[b'x'],[1,3,9,1,1,3,9]),(b'SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT x FROM t2) d LIMIT 8',[b'x'],[3,9,1,1,3,9]),(b'SELECT d.x FROM (SELECT DISTINCT x FROM t2 UNION ALL SELECT x FROM t2) d LIMIT 8',[b'x'],[1,3,9,1,1,3,9]),(b'SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT DISTINCT x FROM t2 ORDER BY 1) d LIMIT 3 OFFSET 1',[b'x'],[1,1,3]),(b'SELECT d.x FROM (SELECT count(*) AS x HAVING 0 UNION ALL SELECT count(*) UNION ALL SELECT 9 LIMIT 1 OFFSET 1) d LIMIT 2',[b'x'],[9]),(b'SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT 9 LIMIT 0) d LIMIT 2',[b'x'],[]),(b'SELECT d.x FROM (SELECT count(*) AS x HAVING 0 UNION ALL SELECT 2) d LIMIT 2',[b'x'],[2]),(b'SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT count(*) HAVING NULL UNION ALL SELECT count(*) HAVING count(*)=1) d LIMIT 3',[b'x'],[2,1]),(b'SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT count(*) WHERE 0 UNION ALL SELECT sum(4) LIMIT 1 OFFSET 1) d LIMIT 2',[b'x'],[0]),(b'SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT count(*) WHERE 0 UNION ALL SELECT sum(4)) d LIMIT 2 OFFSET 1',[b'x'],[0,4]),(b'SELECT d.x FROM (SELECT DISTINCT 1 AS x UNION SELECT DISTINCT 2) d LIMIT 2',[b'x'],[1,2]),(b'SELECT d.x FROM (SELECT DISTINCT 1 AS x UNION ALL SELECT DISTINCT 1 UNION ALL SELECT 2) d LIMIT 3',[b'x'],[1,1,2]),(b'SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT DISTINCT 1 ORDER BY 1) d LIMIT 2',[b'x'],[1,2]),(b'SELECT d.x FROM (SELECT 1 AS x INTERSECT SELECT 1 WHERE NULL) d LIMIT 2',[b'x'],[]),(b'SELECT d.x FROM (SELECT 1 AS x WHERE 0 UNION SELECT 2) d LIMIT 2',[b'x'],[2]),(b'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT 2 WHERE NULL INTERSECT SELECT 1 UNION ALL SELECT 3 WHERE 0) d LIMIT 3',[b'x'],[1]),(b'SELECT d.x FROM (SELECT a%3 AS x, count(*) AS n FROM t1 GROUP BY a%3 ORDER BY n, x LIMIT 3) d LIMIT 2 OFFSET 1',[b'x'],[2,1]),(b'SELECT d.x FROM (SELECT 2 AS x UNION SELECT 1 UNION SELECT 3 ORDER BY 1 DESC) d LIMIT 2 OFFSET 1',[b'x'],[2,1]),(b'SELECT d.x FROM (SELECT 6 AS x UNION ALL SELECT 8 INTERSECT SELECT 8 UNION ALL SELECT 9 ORDER BY 1 DESC) d LIMIT 2',[b'x'],[9,8]),(b'SELECT d.x FROM (SELECT 2 AS x, 1 AS y UNION VALUES(2,2),(2,1)) d LIMIT 2',[b'x'],[2,2]),(b'SELECT d.x FROM (SELECT 6 AS x, 1 AS y UNION ALL SELECT 8, 2 INTERSECT VALUES(6,1),(8,2) UNION ALL SELECT 9, 3) d LIMIT 3',[b'x'],[6,8,9]),(b'SELECT d.x FROM (SELECT 2*3 AS x UNION VALUES(6),(7)) d LIMIT 2',[b'x'],[6,7]),(b'SELECT d.x FROM (SELECT 2*3 AS x UNION ALL SELECT 8 INTERSECT VALUES(6),(8) UNION ALL SELECT 9) d LIMIT 3',[b'x'],[6,8,9]),(b'SELECT d.x FROM (SELECT 0 AS x UNION ALL VALUES(1),(2)) d LIMIT 2 OFFSET 1',[b'x'],[1,2]),(b'SELECT d.x FROM (SELECT 3 AS x UNION ALL VALUES(1),(2) UNION ALL SELECT 4 ORDER BY 1 LIMIT 3) d LIMIT 2 OFFSET 1',[b'x'],[2,3]),(b'SELECT d.x FROM (SELECT 2 AS x, 4 AS y UNION ALL SELECT 1, 3 ORDER BY 2, 1 LIMIT 2) d LIMIT 1 OFFSET 1',[b'x'],[2]),(b'SELECT d.a FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1) d LIMIT 3 OFFSET 3',[b'a'],[7,1,3]),(b'SELECT d.a FROM (SELECT a FROM t1 UNION SELECT a FROM t1) d LIMIT 2 OFFSET 1',[b'a'],[3,5]),(b'SELECT d.a FROM (SELECT a FROM t1 EXCEPT SELECT a FROM t1) d LIMIT 2',[b'a'],[]),(b'SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 ORDER BY x) d',[b'x'],[1]),(b'SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 HAVING count(*)>1 ORDER BY x) d',[b'x'],[1]),(b'SELECT d.n FROM (SELECT count(*) AS n FROM t1 WHERE a>2 LIMIT 1) d',[b'n'],[3]),(b'SELECT d.n FROM (SELECT count(*) AS n FROM t1 HAVING count(*)>9 LIMIT 1) d',[b'n'],[]),(b'SELECT d.x FROM (SELECT DISTINCT a%2 AS x FROM t1) d',[b'x'],[1]),(b'SELECT d.a FROM (SELECT a FROM t1 ORDER BY a LIMIT 2 OFFSET 1) d',[b'a'],[3,5]),(b'SELECT d.a FROM (SELECT a FROM t1 ORDER BY -a LIMIT 2) d',[b'a'],[7,5])]:
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
db=P();assert L.sqlite3_open_v2(str(root/'test/fixtures/in-list/orders-utf8.db').encode(),C.byref(db),1,None)==0
try:
 for expr,expected in [(b'CAST(note AS TEXT)',[None,b'Alpha',b'beta']),(b'+note',[None,b'Alpha',b'beta']),(b"note||''",[None,b'ALPHA',b'Alpha',b'beta'])]:
  s=P();sql=b'SELECT DISTINCT '+expr+b' AS x FROM orders ORDER BY 1'
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   for cycle in range(2):
    got=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100
     value=L.sqlite3_column_text(s,0);assert L.sqlite3_column_type(s,0)==(5 if value is None else 3)
     got.append(value)
    assert got==expected,(expr,got,expected)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 for expr,expected in [(b'CAST(note AS TEXT)',[None,b'Alpha',b'beta',b'Z']),(b'+note',[None,b'Alpha',b'beta',b'Z']),(b"note||''",[None,b'ALPHA',b'Alpha',b'Z',b'beta'])]:
  s=P();sql=b'SELECT DISTINCT '+expr+b" AS x FROM orders UNION ALL SELECT 'Z' ORDER BY 1"
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   for cycle in range(2):
    got=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100
     value=L.sqlite3_column_text(s,0);assert L.sqlite3_column_type(s,0)==(5 if value is None else 3)
     got.append(value)
    assert got==expected,(expr,got,expected)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 s=P();assert L.sqlite3_prepare_v2(db,b"SELECT DISTINCT note AS x FROM orders UNION ALL SELECT 'Z' ORDER BY 1",-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
 try:
  for cycle in range(2):
   got=[]
   while True:
    rc=L.sqlite3_step(s)
    if rc==101:break
    assert rc==100
    value=L.sqlite3_column_text(s,0);assert L.sqlite3_column_type(s,0)==(5 if value is None else 3)
    got.append(value)
   assert got==[None,b'Alpha',b'beta',b'Z'],got
   assert L.sqlite3_reset(s)==0
 finally:assert L.sqlite3_finalize(s)==0
 for expr,expected in [(b"min(note,'Z')",b'beta'),(b"max(note,'Z')",b'Z'),(b"min(note,'Z' COLLATE binary)",b'beta'),(b"min('Z',note)",b'beta'),(b"min('Z' COLLATE binary,note)",b'Z'),(b"min(note||'','Z')",b'Z'),(b"nullif(note,'BETA')",None)]:
  s=P();sql=b'SELECT '+expr+b' AS x FROM orders WHERE id=11'
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   for cycle in range(2):
    assert L.sqlite3_step(s)==100
    assert L.sqlite3_column_type(s,0)==(5 if expected is None else 3)
    assert L.sqlite3_column_text(s,0)==expected,(expr,expected)
    assert L.sqlite3_step(s)==101
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 for expr,expected in [(b"note||'' = 'alpha'",0),(b"lower(note) = 'ALPHA'",0),(b"CASE WHEN 1 THEN note END = 'alpha'",0),(b"CAST(note AS TEXT) = 'alpha'",1),(b"+note = 'alpha'",1),(b"'alpha' = note",1),(b"(note||'') COLLATE nocase = 'alpha'",1),(b"min(note,'Z') = 'Alpha'",1)]:
  s=P();sql=b'SELECT '+expr+b' AS x FROM orders WHERE id=10'
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   for cycle in range(2):
    assert L.sqlite3_step(s)==100
    assert L.sqlite3_column_type(s,0)==1
    assert L.sqlite3_column_int64(s,0)==expected,(expr,expected)
    assert L.sqlite3_step(s)==101
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 for expr,expected in [(b'CAST(note AS TEXT)',[b'a',b'Alpha']),(b'+note',[b'a',b'Alpha']),(b"note||''",[b'Alpha',b'a'])]:
  sql=b'SELECT '+expr+b" AS x FROM orders WHERE id=10 UNION ALL SELECT 'a' ORDER BY 1"
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_name(s,0)==b'x'
   for cycle in range(2):
    got=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100,L.sqlite3_errmsg(db)
     assert L.sqlite3_column_type(s,0)==3
     got.append(L.sqlite3_column_text(s,0))
    assert got==expected,(sql,got,expected)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
finally:assert L.sqlite3_close(db)==0
print('pinned implicit CAST/UPLUS and concat collation OK')
