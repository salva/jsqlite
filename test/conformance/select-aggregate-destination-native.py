#!/usr/bin/env python3
"""Pinned SQLite grouped destination baseline on the read-only fixture."""
import ctypes as C
import json
import pathlib
import sys
r=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((r/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
current=json.loads((r/'test/fixtures/CURRENT.json').read_text())
fixture=r/'test/fixtures/generations'/current['generationId']/'generated/expr-relational.db'
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=result
assert L.sqlite3_sourceid().decode()==source
sql=b'SELECT y%2 AS k, count(*) AS n FROM t1 GROUP BY y%2 ORDER BY k'
db=P();assert L.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
stmt=P()
try:
 assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(stmt),None)==0
 assert [L.sqlite3_column_name(stmt,i).decode() for i in range(L.sqlite3_column_count(stmt))]==['k','n']
 for _ in range(2):
  rows=[]
  while (rc:=L.sqlite3_step(stmt))==100:
   rows.append([(L.sqlite3_column_type(stmt,i),L.sqlite3_column_int64(stmt,i)) for i in range(2)])
  assert rc==101 and rows==[[(1,0),(1,16)],[(1,1),(1,16)]],rows
  assert L.sqlite3_reset(stmt)==0
 print(json.dumps({'sourceId':source,'names':['k','n'],'rows':rows,'iterations':2}))
finally:
 if stmt: assert L.sqlite3_finalize(stmt)==0
 assert L.sqlite3_close(db)==0
