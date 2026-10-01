#!/usr/bin/env python3
"""Pinned 3.53.4: a CTE source in a UNION ALL arm retains its source identity."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
cases=[(b'WITH q(x) AS (VALUES(1)) SELECT x FROM q UNION ALL SELECT 2',[(1,1),(1,2)]),
 (b'WITH q(x) AS MATERIALIZED (VALUES(1)) SELECT x FROM q UNION ALL SELECT 2',[(1,1),(1,2)]),
 (b'WITH q(x) AS NOT MATERIALIZED (VALUES(1)) SELECT x FROM q UNION ALL SELECT x FROM q',[(1,1),(1,1)])]
try:
 for sql,expected in cases:
  stmt=P();rc=L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),None)
  assert rc==0,(sql,rc,L.sqlite3_errmsg(db))
  try:
   assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==b'x'
   for _ in range(2):
    rows=[]
    while (rc:=L.sqlite3_step(stmt))==100:rows.append((L.sqlite3_column_type(stmt,0),L.sqlite3_column_int64(stmt,0)))
    assert rc==101,(sql,rc,L.sqlite3_errmsg(db));assert rows==expected,(sql,rows)
    assert L.sqlite3_reset(stmt)==0
  finally:assert L.sqlite3_finalize(stmt)==0
 bad=P();rc=L.sqlite3_prepare_v2(db,b'WITH q(x) AS (VALUES(1)) SELECT missing FROM q UNION ALL SELECT 2',-1,C.byref(bad),None)
 assert rc==1 and b'no such column: missing' in L.sqlite3_errmsg(db),(rc,L.sqlite3_errmsg(db))
 if bad:assert L.sqlite3_finalize(bad)==0
 print('pinned CTE compound source identity, types, names, reset and error: OK')
finally:assert L.sqlite3_close(db)==0
