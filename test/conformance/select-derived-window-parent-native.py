#!/usr/bin/env python3
"""Pinned 3.53.4 materialized FROM window source and outer destination boundary."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];L=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_decltype',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];db=P()
assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/g/'generated/subquery-utf8.db').encode(),C.byref(db),1,None)==0
for name in ['sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']:
 f=getattr(L,name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
try:
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"WITH c AS (SELECT a AS x FROM t1 LIMIT 2) SELECT x FROM c UNION ALL SELECT 9",-1,C.byref(stmt),C.byref(tail))==0
 assert (L.sqlite3_column_name(stmt,0),L.sqlite3_column_decltype(stmt,0),L.sqlite3_column_database_name(stmt,0),L.sqlite3_column_table_name(stmt,0),L.sqlite3_column_origin_name(stmt,0))==(b'x',b'INTEGER',b'main',b't1',b'a')
 for cycle in range(2):
  for value in [1,3,9]:assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==value
  assert L.sqlite3_step(stmt)==101
  if cycle==0:assert L.sqlite3_reset(stmt)==0
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"WITH c AS (SELECT a AS x FROM t1 LIMIT 2) SELECT missing FROM c UNION ALL SELECT 9",-1,C.byref(stmt),C.byref(tail))==1
 assert b'no such column' in L.sqlite3_errmsg(db)
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"WITH c AS (SELECT a AS x FROM t1 LIMIT 0) SELECT x FROM c UNION ALL SELECT 9",-1,C.byref(stmt),C.byref(tail))==0
 assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==9
 assert L.sqlite3_step(stmt)==101 and L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT * FROM (SELECT a FROM (SELECT a FROM t1 LIMIT 2) LIMIT 1)",-1,C.byref(stmt),C.byref(tail))==0
 assert (L.sqlite3_column_name(stmt,0),L.sqlite3_column_decltype(stmt,0),L.sqlite3_column_database_name(stmt,0),L.sqlite3_column_table_name(stmt,0),L.sqlite3_column_origin_name(stmt,0))==(b'a',b'INTEGER',b'main',b't1',b'a')
 for cycle in range(2):
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==1
  assert L.sqlite3_step(stmt)==101
  if not cycle:assert L.sqlite3_reset(stmt)==0
 assert L.sqlite3_finalize(stmt)==0
 for outer,want in [('LIMIT 1 OFFSET 1',[3]),('LIMIT 0',[])]:
  stmt=P();tail=C.c_char_p();sql=f'SELECT * FROM (SELECT a FROM (SELECT a FROM t1 LIMIT 2) {outer})'
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),C.byref(tail))==0
  rows=[]
  while L.sqlite3_step(stmt)==100:
   assert L.sqlite3_column_type(stmt,0)==1
   rows.append(L.sqlite3_column_int64(stmt,0))
  assert rows==want and L.sqlite3_finalize(stmt)==0
 L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT row_number() OVER (ORDER BY a) FROM t1 WHERE (a=1)",-1,C.byref(stmt),C.byref(tail))==0
 assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1 and L.sqlite3_column_type(stmt,0)==1
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE (a BETWEEN 1 AND 1)) OVER () FROM t1 LIMIT 1",-1,C.byref(stmt),C.byref(tail))==0
 assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1 and L.sqlite3_column_type(stmt,0)==1
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE a IN (1)) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1",-1,C.byref(stmt),C.byref(tail))==0
 for value in [1,1,None,None]:
  assert L.sqlite3_step(stmt)==100
  assert L.sqlite3_column_type(stmt,0)==(5 if value is None else 1)
  if value is not None:assert L.sqlite3_column_int64(stmt,0)==value
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE CASE WHEN a=1 THEN NULL ELSE 0 END) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM t1",-1,C.byref(stmt),C.byref(tail))==0
 for value in range(4):
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==5
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE CASE WHEN a=1 THEN NULL ELSE 0 END) OVER (GROUPS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) FROM t1",-1,C.byref(stmt),C.byref(tail))==0
 for cycle in range(2):
  for value in range(4):assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==5
  assert L.sqlite3_step(stmt)==101
  if cycle==0:assert L.sqlite3_reset(stmt)==0
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE (a IN (1))) OVER () FROM (SELECT a FROM t1 LIMIT 2)",-1,C.byref(stmt),C.byref(tail))==0
 for value in range(2):assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==1
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE abs(a)=1) OVER (ORDER BY a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1",-1,C.byref(stmt),C.byref(tail))==0
 for value in range(4):assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==1
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT sum(a) FILTER (WHERE a=1) OVER (ORDER BY a GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM t1",-1,C.byref(stmt),C.byref(tail))==0
 for value in [None,1,1,1]:
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==(5 if value is None else 1)
  if value is not None:assert L.sqlite3_column_int64(stmt,0)==value
 assert L.sqlite3_step(stmt)==101
 assert L.sqlite3_finalize(stmt)==0
 for sql,expected in [("SELECT sum(a) OVER () FROM (SELECT a FROM t1 LIMIT 0)",[]),("SELECT sum(a) OVER () FROM (SELECT a FROM t1 LIMIT 1 OFFSET 1)",[3]),("SELECT sum(d.a) FILTER (WHERE d.a=1) OVER () FROM (SELECT a FROM t1 LIMIT 2) d LIMIT 1",[1])]:
  stmt=P();tail=C.c_char_p()
  assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),C.byref(tail))==0
  for value in expected:assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==value
  assert L.sqlite3_step(stmt)==101
  assert L.sqlite3_finalize(stmt)==0
 for sql,value in [(b"SELECT CASE WHEN (x=1) THEN (x) ELSE 0 END FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1",1),(b"SELECT CASE (x) WHEN 1 THEN (x) ELSE 0 END FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1",1),(b"SELECT b.x FROM t2 a FULL JOIN t2 b ON 0 WHERE a.x IS NULL AND b.x=9 LIMIT 1",9)]:
  stmt=P();tail=C.c_char_p()
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0
  for cycle in range(2):
   assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==value and L.sqlite3_column_type(stmt,0)==1
   assert L.sqlite3_step(stmt)==101
   assert L.sqlite3_reset(stmt)==0
  assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT x FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1",-1,C.byref(stmt),C.byref(tail))==0
 assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1 and L.sqlite3_column_type(stmt,0)==1
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT (SELECT sum((a)) FROM t1 WHERE (a=x)) AS v FROM t2 a FULL JOIN t2 b USING(x) LIMIT 1",-1,C.byref(stmt),C.byref(tail))==0
 assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1 and L.sqlite3_column_type(stmt,0)==1
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,b"SELECT coalesce(1,abs(-9223372036854775808)) AS x",-1,C.byref(stmt),C.byref(tail))==0
 for cycle in range(2):
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1 and L.sqlite3_column_type(stmt,0)==1
  assert L.sqlite3_step(stmt)==101
  assert L.sqlite3_reset(stmt)==0
 assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p();sql=b"SELECT d.x FROM (SELECT 'a' COLLATE NOCASE AS x FROM t1 LIMIT 1) d UNION ALL SELECT 'B' ORDER BY 1"
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'x'
  assert L.sqlite3_column_decltype(stmt,0) is None
  for cycle in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100 and L.sqlite3_column_type(stmt,0)==3
    rows.append(L.sqlite3_column_text(stmt,0).decode())
   assert rows==['a','B'],rows
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p();sql=b"SELECT d.x FROM (SELECT 'a' AS x FROM t1 LIMIT 1) d UNION ALL SELECT 'B' COLLATE NOCASE ORDER BY 1"
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'x'
  for cycle in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100 and L.sqlite3_column_type(stmt,0)==3
    rows.append(L.sqlite3_column_text(stmt,0).decode())
   assert rows==['B','a'],rows
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p();sql=b"SELECT d.x FROM (SELECT 'a' COLLATE NOCASE AS x UNION ALL SELECT 'c') d UNION ALL SELECT 'B' ORDER BY 1"
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'x'
  for cycle in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100 and L.sqlite3_column_type(stmt,0)==3
    rows.append(L.sqlite3_column_text(stmt,0).decode())
   assert rows==['a','B','c'],rows
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 stmt=P();tail=C.c_char_p();sql=b"SELECT d.x AS renamed FROM (SELECT 'a' COLLATE NOCASE AS x LIMIT 1) d UNION ALL SELECT 'B' ORDER BY 1"
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'renamed'
  for cycle in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100 and L.sqlite3_column_type(stmt,0)==3
    rows.append(L.sqlite3_column_text(stmt,0).decode())
   assert rows==['a','B'],rows
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 for sql in [b'SELECT (SELECT d.rowid FROM (SELECT a AS x FROM t1 UNION ALL SELECT 2) d LIMIT 0)',b'SELECT (SELECT d._rowid_ FROM (SELECT a AS x FROM t1 UNION ALL SELECT 2) d LIMIT 0)',b'SELECT (SELECT d.oid FROM (SELECT a AS x FROM t1 UNION ALL SELECT 2) d LIMIT 0)',b'SELECT d.missing COLLATE NOCASE FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.rowid FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d._rowid_ FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.oid FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.missing FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT n.missing FROM (SELECT a AS x FROM t1 LIMIT 0) n) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT missing FROM t1) d UNION ALL SELECT 2 ORDER BY 1',b'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT missing FROM t1 LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1']:
  stmt=P();tail=C.c_char_p()
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==1
  assert not stmt.value and b'no such column:' in L.sqlite3_errmsg(db)
 for projection,names,expected in [('d.z',[b'z'],[[30],[31]]),('d.z,d.x,d.z',[b'z',b'x',b'z'],[[30,1,30],[31,2,31]])]:
  stmt=P();tail=C.c_char_p();sql=f'SELECT {projection} FROM (SELECT 1 AS x,20 AS y,30 AS z UNION ALL SELECT 2,21,31 LIMIT 2) d LIMIT 2'.encode()
  assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert [L.sqlite3_column_name(stmt,index) for index in range(len(names))]==names
   for cycle in range(2):
    rows=[]
    while L.sqlite3_step(stmt)==100:
     assert all(L.sqlite3_column_type(stmt,index)==1 for index in range(len(names)))
     rows.append([L.sqlite3_column_int64(stmt,index) for index in range(len(names))])
    assert rows==expected,rows
    assert L.sqlite3_reset(stmt)==0
  finally:L.sqlite3_finalize(stmt)
 stmt=P();tail=C.c_char_p();sql=b'SELECT d.x FROM (SELECT 9 AS x UNION ALL SELECT a FROM t1 LIMIT 2) d LIMIT 2'
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'x' and L.sqlite3_column_decltype(stmt,0)==b'INTEGER'
  values=[]
  while L.sqlite3_step(stmt)==100:values.append(L.sqlite3_column_int64(stmt,0))
  assert values==[9,1],values
 finally:L.sqlite3_finalize(stmt)
 stmt=P();tail=C.c_char_p();sql=b'SELECT d.x AS chosen FROM (SELECT a AS x FROM t1 LIMIT 1) d UNION ALL SELECT 2 ORDER BY 1'
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'chosen'
  assert L.sqlite3_column_decltype(stmt,0)==b'INTEGER',repr(L.sqlite3_column_decltype(stmt,0))
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_int64(stmt,0)==1
 finally:L.sqlite3_finalize(stmt)
 stmt=P();tail=C.c_char_p();sql=b'SELECT (SELECT a FROM t1 LIMIT 1) AS chosen'
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'chosen'
  assert L.sqlite3_column_decltype(stmt,0)==b'INTEGER'
  assert L.sqlite3_step(stmt)==100 and L.sqlite3_column_type(stmt,0)==1 and L.sqlite3_column_int64(stmt,0)==1
 finally:L.sqlite3_finalize(stmt)
 stmt=P();tail=C.c_char_p();sql=b'SELECT d.x FROM (SELECT ((CAST(1 AS REAL))) AS x UNION ALL SELECT 2 LIMIT 2) d UNION ALL SELECT 3 ORDER BY 1'
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
 try:
  assert L.sqlite3_column_name(stmt,0)==b'x'
  for cycle in range(2):
   types=[];values=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100;types.append(L.sqlite3_column_type(stmt,0));values.append(L.sqlite3_column_int64(stmt,0))
   assert types==[2,1,1] and values==[1,2,3],(types,values)
   assert L.sqlite3_reset(stmt)==0
 finally:assert L.sqlite3_finalize(stmt)==0
 for sql,name,expected in [
  (b'SELECT d.rowid FROM (SELECT 1 AS rowid LIMIT 1) d UNION ALL SELECT 2 ORDER BY 1',b'rowid',[1,2]),
  (b'WITH q(x) AS (VALUES(2),(1)) SELECT d.renamed FROM (SELECT x AS renamed FROM q UNION ALL SELECT x FROM q) d LIMIT 4',b'renamed',[2,1,2,1]),
  (b'VALUES((SELECT a FROM t1 LIMIT 1)),(3) UNION ALL SELECT a FROM t1',b'column1',[1,3,1,3,5,7]),
  (b'SELECT a AS x FROM t1 UNION ALL VALUES((SELECT a FROM t1 LIMIT 1)),(8)',b'x',[1,3,5,7,1,8]),
  (b'VALUES((SELECT a FROM t1 LIMIT 1)),(3) UNION ALL SELECT a FROM t1 LIMIT 2 OFFSET 1',b'column1',[3,1])
 ]:
  stmt=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==name
   for cycle in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100 and L.sqlite3_column_type(stmt,0)==1
     rows.append(L.sqlite3_column_int64(stmt,0))
    assert rows==expected,(sql,rows);assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 for sql,expected in [
  (b'SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY 2,1 DESC',[[3,1],[2,1],[1,2]]),
  (b'SELECT * FROM (SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY 2,1 DESC) n',[[3,1],[2,1],[1,2]]),
  (b'SELECT * FROM (SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY y,x DESC LIMIT 1 OFFSET 1) n',[[2,1]])
 ]:
  stmt=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(stmt)==2 and L.sqlite3_column_name(stmt,0)==b'x' and L.sqlite3_column_name(stmt,1)==b'y'
   for cycle in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100 and all(L.sqlite3_column_type(stmt,i)==1 for i in range(2))
     rows.append([L.sqlite3_column_int64(stmt,i) for i in range(2)])
    assert rows==expected,(sql,rows);assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 for sql,expected in [
  (b'SELECT d.x FROM (SELECT a AS x FROM t1 LIMIT 2) d UNION ALL SELECT 2 ORDER BY 1',[1,2,3]),
  (b'SELECT d.x FROM (SELECT a AS x FROM t1 LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',[2]),
  (b'SELECT d.x FROM (SELECT a AS x FROM t1 WHERE a>3) d UNION ALL SELECT 2 ORDER BY 1',[2,5,7]),
  (b'SELECT d.x FROM (SELECT a AS x FROM t1 WHERE a>3) d WHERE d.x<7 UNION ALL SELECT 2 ORDER BY 1',[2,5]),
  (b'SELECT row_number() OVER (ORDER BY a) AS x FROM t1 UNION ALL SELECT 2 ORDER BY 1',[1,2,2,3,4]),
  (b'SELECT row_number() OVER (ORDER BY a) AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[2]),
  (b'WITH q(x) AS (SELECT a FROM t1 WHERE a>3) SELECT x FROM q UNION ALL SELECT 2 ORDER BY 1',[2,5,7]),
  (b'WITH q(x) AS (SELECT a FROM t1 WHERE a>3) SELECT x FROM q WHERE x<7 UNION ALL SELECT 2 ORDER BY 1',[2,5]),
  (b'SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT (SELECT a FROM t1 WHERE a=1) ORDER BY 1',[1,1,3,5,7]),
  (b'SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT NULL WHERE 0 ORDER BY 1',[1,3,5,7]),
  (b'SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT NULL ORDER BY 1',[None,1,3,5,7]),
  (b'SELECT DISTINCT a%2 AS x FROM t1 UNION ALL SELECT 1 ORDER BY 1',[1,1]),
  (b'SELECT DISTINCT a AS x FROM t1 WHERE 0 UNION ALL SELECT 1 ORDER BY 1',[1]),
  (b'SELECT DISTINCT NULL AS x FROM t1 UNION ALL SELECT NULL ORDER BY 1',[None,None]),
  (b'SELECT sum(a) AS x FROM t1 UNION ALL SELECT 2 ORDER BY 1',[2,16]),
  (b'SELECT sum(a) AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[None,2]),
  (b'SELECT sum(a) AS x FROM t1 HAVING sum(a)>99 UNION ALL SELECT 2 ORDER BY 1',[2]),
  (b'SELECT sum(a) AS x FROM t1 GROUP BY a UNION ALL SELECT 2 ORDER BY 1',[1,2,3,5,7]),
  (b'SELECT a AS x FROM t1 WHERE a>3 UNION ALL SELECT 2 ORDER BY 1',[2,5,7]),
  (b'SELECT a AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[2]),
  (b'SELECT a AS x FROM t1 WHERE a=1 UNION ALL SELECT 1 ORDER BY 1',[1,1]),
  (b'WITH q(x) AS (VALUES((SELECT a FROM t1 WHERE a=1)),(3)) SELECT x FROM q UNION ALL SELECT x FROM q',[1,3,1,3]),
  (b'WITH q(x) AS (SELECT (SELECT a FROM t1 WHERE 0)) SELECT x FROM q UNION ALL SELECT x FROM q',[None,None]),
  (b'SELECT a AS x FROM t1 UNION ALL SELECT (SELECT a FROM t1 LIMIT 1) ORDER BY 1',[1,1,3,5,7]),
  (b'SELECT a AS x FROM t1 UNION ALL VALUES((SELECT a FROM t1 LIMIT 1)),(8) UNION ALL SELECT 9 ORDER BY 1',[1,1,3,5,7,8,9]),
  (b'SELECT a AS x FROM t1 UNION ALL SELECT 8 WHERE (SELECT a FROM t1 LIMIT 1)=0 ORDER BY 1',[1,3,5,7]),
  (b'SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION ALL SELECT 8',[1,8]),
  (b'SELECT 8 AS x UNION ALL SELECT (SELECT a FROM t1 LIMIT 1) LIMIT 1 OFFSET 1',[1]),
  (b'SELECT 8 AS x UNION ALL SELECT (SELECT a FROM t1 LIMIT 0)',[8,None]),
  (b'SELECT 2 AS x UNION ALL SELECT 2 UNION ALL SELECT 1 ORDER BY x DESC',[2,2,1]),
  (b'SELECT NULL AS x UNION ALL SELECT 1 ORDER BY 1 DESC NULLS FIRST',[None,1]),
  (b'SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION ALL SELECT 8 ORDER BY 1 DESC LIMIT 1 OFFSET 1',[1]),
  (b'SELECT 2 AS x UNION SELECT 1 EXCEPT SELECT 2',[1]),
  (b'SELECT 2 AS x UNION ALL SELECT 2 INTERSECT SELECT 2',[2]),
  (b'SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 LIMIT 2 OFFSET 1',[2,8]),
  (b'SELECT 2 AS x UNION SELECT 1 ORDER BY 1 DESC LIMIT 1 OFFSET 1',[1]),
  (b'SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION SELECT 8',[1,8]),
  (b'SELECT (SELECT 8) AS x EXCEPT SELECT 1',[8]),
  (b'SELECT (SELECT 8) AS x INTERSECT SELECT 8',[8]),
  (b'SELECT 1 AS x UNION SELECT 2 UNION ALL SELECT (SELECT 8)',[1,2,8]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 UNION ALL SELECT 2 ORDER BY 1 DESC) n',[2,2,1]),
  (b'SELECT x FROM (SELECT NULL AS x UNION ALL SELECT 1 ORDER BY 1 DESC NULLS FIRST) n',[None,1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 UNION ALL SELECT 2 ORDER BY 1 DESC LIMIT 2 OFFSET 1) n',[2,1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 ORDER BY 1 DESC) n',[2,1]),
  (b'SELECT x FROM (SELECT NULL AS x UNION SELECT 1 ORDER BY 1 DESC NULLS FIRST) n',[None,1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 3 ORDER BY 1 DESC LIMIT 2 OFFSET 1) n',[2,1])
 ]:
  stmt=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==b'x'
   for cycle in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100
     typ=L.sqlite3_column_type(stmt,0);assert typ in (1,5)
     rows.append(None if typ==5 else L.sqlite3_column_int64(stmt,0))
    assert rows==expected,(sql,rows);assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 for sql,expected in [
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2) n',[1,2,2]),
  (b'SELECT x FROM (SELECT 2 AS x EXCEPT SELECT 2 UNION ALL SELECT 1) n',[1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2 LIMIT 2 OFFSET 1) n',[2,2]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2 LIMIT 1 OFFSET 2) n',[2]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 2 UNION SELECT 1) n',[1,2]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 INTERSECT SELECT 2) n',[2]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 EXCEPT SELECT 2) n',[1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 2 UNION SELECT 1 LIMIT 1 OFFSET 1) n',[2]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 EXCEPT SELECT 2) n',[1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 INTERSECT SELECT 2) n',[2]),
  (b'SELECT x FROM (SELECT 2 AS x EXCEPT SELECT 2 UNION SELECT 1) n',[1]),
  (b'SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION SELECT 2 LIMIT 1 OFFSET 1) n',[2])
 ]:
  stmt=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==b'x'
   for cycle in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100 and L.sqlite3_column_type(stmt,0)==1
     rows.append(L.sqlite3_column_int64(stmt,0))
    assert rows==expected,(sql,rows);assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 for sql,expected in [
  (b'SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) UNION VALUES(1,NULL),(3,NULL)) n',[[1,None],[2,None],[3,None]]),
  (b'SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) INTERSECT VALUES(2,NULL),(3,NULL)) n',[[2,None]]),
  (b'SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) EXCEPT VALUES(2,NULL),(3,NULL)) n',[[1,None]])
 ]:
  stmt=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),C.byref(tail))==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(stmt)==2 and L.sqlite3_column_name(stmt,0)==b'column1'
   for cycle in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100,L.sqlite3_errmsg(db)
     assert [L.sqlite3_column_type(stmt,i) for i in range(2)]==[1,5]
     rows.append([L.sqlite3_column_int64(stmt,0),None])
    assert rows==expected,(sql,rows);assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 for sql in [b'SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION SELECT 8) n',b'SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 ORDER BY 1 DESC) n',b'SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)) n',b'VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)',b'SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3) UNION ALL SELECT 8 LIMIT 3) n',b'SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 1 OFFSET 1) n',b'SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 2) n',b'SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 1) n UNION ALL SELECT 8',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE NULL',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 1',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 1',b'SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8',b'SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 LIMIT 1 OFFSET 0',b'SELECT 3 AS x WHERE EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 WHERE 0 UNION ALL SELECT 8 WHERE 0) d) UNION ALL SELECT 8',b'SELECT 3 AS x WHERE EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d) UNION ALL SELECT 8 LIMIT 1 OFFSET 1',b'SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 1 UNION ALL SELECT 8',b'SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8',b'SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x',b'SELECT n."x:1" FROM (SELECT 2 AS "x:", 1 AS "x:") n UNION ALL SELECT 8',b'SELECT d.column1 FROM (SELECT column1 FROM (VALUES(2),(1)) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT column1 FROM (VALUES(2),(1)) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',b'SELECT d.x FROM (SELECT x FROM (SELECT 3 AS x LIMIT 1) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT x FROM (SELECT 3 AS x LIMIT 1) n UNION ALL SELECT 8 LIMIT 1 OFFSET 1',b'SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 ORDER BY x LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT x FROM (SELECT DISTINCT x FROM t2 ORDER BY x LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',b'SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',b'SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1) d LIMIT 1',b'SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 0',b'SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 1 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 WHERE 0) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT x FROM (SELECT DISTINCT x FROM t2) n UNION ALL SELECT 8',b'SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1) UNION ALL SELECT 8) d LIMIT 4',b'SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1)',b'SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1) n UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.r FROM (SELECT row_number() OVER () AS r UNION ALL SELECT row_number() OVER ()) d LIMIT 4',b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1',b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 WHERE 0 UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.r FROM (SELECT row_number() OVER () AS r UNION ALL SELECT 8) d LIMIT 4',b'WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT x FROM q) d',b'WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT x FROM q) d LIMIT 4',b'SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE 0 UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE a>1 UNION ALL SELECT 8) d LIMIT 0',b'SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE a>1 UNION ALL SELECT 8) d LIMIT 4',b'WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT 8) d LIMIT 4',b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5 LIMIT 3 OFFSET 1) d',b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5) d LIMIT 2 OFFSET 1',b'SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT x FROM t2 WHERE 0) d',b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5 LIMIT 0) d',b'SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5) d',b'SELECT d.s FROM (SELECT sum(a) AS s FROM t1 UNION ALL SELECT 8 ORDER BY 1) d',b'WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4 LIMIT 0) SELECT row_number() OVER (ORDER BY x) AS r FROM q',b'WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4 LIMIT 2 OFFSET 1) SELECT row_number() OVER (ORDER BY x) AS r FROM q ORDER BY r DESC',b'WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4) SELECT row_number() OVER (ORDER BY x) AS r FROM q',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY s DESC LIMIT 2 OFFSET 1',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY 2 DESC LIMIT 2 OFFSET 1',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY r DESC LIMIT 2 OFFSET 1',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY a DESC LIMIT 2 OFFSET 1',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 WHERE 0 GROUP BY a',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a LIMIT 0',b'SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a',b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 2 OFFSET 1',b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 0']:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   grouped=b'GROUP BY' in sql
   width=2 if grouped else 1
   assert L.sqlite3_column_count(s)==width and L.sqlite3_column_name(s,0)==(b'column1' if sql.startswith(b'VALUES(') else b'column1' if sql.startswith(b'SELECT column1 FROM') else b'x' if sql.startswith(b'SELECT x FROM (SELECT (SELECT') or sql.startswith(b'SELECT 3 AS x') or sql.startswith((b'SELECT (SELECT',b'SELECT DISTINCT (SELECT')) else b'x:1' if sql.startswith(b'SELECT n.') else b'column1' if b'FROM (VALUES(2),(1))' in sql else b's' if grouped or sql.startswith(b'SELECT d.s') else b'x' if sql.startswith(b'SELECT d.x') or sql.startswith(b'SELECT x FROM') or sql.startswith(b'WITH q(x)') else b'r')
   if grouped:assert L.sqlite3_column_name(s,1)==b'r'
   for run in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100,L.sqlite3_errmsg(db)
     types=[L.sqlite3_column_type(s,i) for i in range(width)]
     assert all(t==1 or (t==5 and sql.startswith(b'SELECT d.s') and b'WHERE 0' in sql) for t in types),types
     values=[None if types[i]==5 else L.sqlite3_column_int64(s,i) for i in range(width)]
     rows.append(values if grouped else values[0])
    if sql.startswith(b'SELECT d.r') and b'UNION ALL' in sql:assert rows==([] if sql.endswith((b'AS x WHERE 0',b'AS x WHERE NULL')) else [1,1] if b'UNION ALL SELECT row_number' in sql else [8] if b'WHERE 0' in sql else [2,3] if b'LIMIT 2' in sql else [1,8]),rows
    if sql.startswith(b'SELECT x FROM (SELECT (SELECT'):assert rows==([8,1] if sql.endswith(b'ORDER BY 1 DESC) n') else [8] if sql.endswith(b'OFFSET 1) n') else [1,8]),rows
    if sql.startswith(b'SELECT column1 FROM (VALUES((SELECT'):assert rows==([1,3] if sql.endswith(b'(3)) n') else [1,3,8]),rows
    if sql.startswith(b'VALUES('):assert rows==[1,3],rows
    if sql.startswith(b'SELECT 3 AS x'):assert rows==[8],rows
    if sql.startswith((b'SELECT (SELECT',b'SELECT DISTINCT (SELECT')):assert rows==([] if sql.endswith((b'AS x WHERE 0',b'AS x WHERE NULL')) else [1,1] if sql.endswith(b'UNION ALL SELECT 1') else [8] if b'AS x WHERE 0' in sql else ([1,8] if sql.endswith(b'UNION ALL SELECT 8') else [1])),rows
    if sql.startswith(b'SELECT n.'):assert rows==([8,1] if sql.endswith(b'ORDER BY 1 DESC) n') else [8] if sql.endswith(b'OFFSET 1) n') else [1,8]),rows
    if b'FROM (VALUES(2),(1))' in sql:assert rows==([1,8] if b'OFFSET 1' in sql else [2,1,8]),rows
    if sql.startswith(b'SELECT x FROM') and not sql.startswith(b'SELECT x FROM (SELECT (SELECT'):assert rows==([8] if b'SELECT 3 AS x' in sql else [] if b'UNION ALL SELECT 8 LIMIT 0' in sql else [9,8] if b'UNION ALL SELECT 8 LIMIT 2 OFFSET 1' in sql else [1,3,9,8] if b'DISTINCT' in sql else [3,5,7]),rows
    if sql.startswith(b'WITH q(x)'):assert rows==([2,1,2,1] if b'UNION ALL SELECT x FROM q' in sql else [2,1,8]),rows
    if sql.startswith(b'SELECT d.x'):
      expected=[3,8] if b'SELECT 3 AS x' in sql else ([3,9,8] if b'ORDER BY x' in sql else [9] if b'UNION ALL SELECT 8 LIMIT 2 OFFSET 1' in sql else [8] if b'WHERE 0' in sql else [3,8] if b'LIMIT 1 OFFSET 1' in sql else [1,3,9,8]) if b'DISTINCT' in sql else [5,7,8] if b'a>1 LIMIT 2' in sql else [3,5,7,8] if b'FROM (SELECT a AS x' in sql else [] if b'WHERE 0' in sql or b'LIMIT 0' in sql else [9,1,1] if b'LIMIT 3' in sql else [9,1] if b'LIMIT 2' in sql else [3,9,1,1,3]
      assert rows==expected,rows
    if sql.startswith(b'SELECT d.s'):assert rows==([] if b'LIMIT 0' in sql else [None,8] if b'WHERE 0' in sql else [15,8] if b'WHERE a>1' in sql else [8,16]),rows
    if sql.startswith(b'WITH RECURSIVE'):assert rows==([] if b'LIMIT 0' in sql else [2,1] if b'DESC' in sql else [1,2,3,4]),rows
    if grouped:assert rows==([] if b'WHERE 0' in sql or b'LIMIT 0' in sql else [[5,3],[3,2]] if b'DESC' in sql else [[1,1],[3,2],[5,3],[7,4]]),rows
    if run==0:print(sql.decode(),rows)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 bad=P();rc=L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1',-1,C.byref(bad),None)
 print('missing',rc,L.sqlite3_errmsg(db));assert rc==1 and not bad.value
finally:assert L.sqlite3_close(db)==0
