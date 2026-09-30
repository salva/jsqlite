#!/usr/bin/env python3
"""Pinned native queue/dedup/priority recursive destination baseline."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=result
assert L.sqlite3_sourceid().decode()==source
cases=[
 ('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c',[1,2,3,4]),
 ('WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3 UNION SELECT x FROM c) SELECT x FROM c',[1,2,3]),
 ('WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x*2 FROM q WHERE x<4 UNION ALL SELECT x*2+1 FROM q WHERE x<4 ORDER BY 1 DESC) SELECT x FROM q',[1,3,7,6,2,5,4]),
]
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 for sql,expected in cases:
  stmt=P()
  try:
   assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,sql
   assert L.sqlite3_column_count(stmt)==1 and L.sqlite3_column_name(stmt,0)==b'x'
   for _ in range(2):
    rows=[]
    while (rc:=L.sqlite3_step(stmt))==100:rows.append((L.sqlite3_column_type(stmt,0),L.sqlite3_column_int64(stmt,0)))
    assert rc==101 and rows==[(1,x) for x in expected],(sql,rows)
    assert L.sqlite3_reset(stmt)==0
   print(json.dumps({'sourceId':source,'sql':sql,'names':['x'],'rows':rows,'iterations':2}))
  finally:
   if stmt:assert L.sqlite3_finalize(stmt)==0
finally:assert L.sqlite3_close(db)==0
