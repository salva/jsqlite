#!/usr/bin/env python3
"""Pinned select.c compound first-arm transient names and multirow arm exhaustion."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
fixture=root/'test/fixtures/generations'/generation/'generated/subquery-utf8.db'
lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=result
assert lib.sqlite3_sourceid().decode()==source
base='SELECT d.x,d."x:1" FROM (SELECT a AS x,b AS x FROM t1 WHERE a IN (1,3) UNION ALL SELECT a,b FROM t1 WHERE a=5) d'
cases=[(base,[[(1,1),(1,2)],[(1,3),(1,4)],[(1,5),(1,6)]])]
db=P();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 for sql,expected in cases:
  stmt=P()
  try:
   assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,(sql,lib.sqlite3_errmsg(db))
   assert [lib.sqlite3_column_name(stmt,i).decode() for i in range(lib.sqlite3_column_count(stmt))]==['x','x:1']
   for _ in range(2):
    rows=[]
    while True:
     rc=lib.sqlite3_step(stmt)
     if rc==101:break
     assert rc==100,(sql,rc,lib.sqlite3_errmsg(db))
     rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i) if lib.sqlite3_column_type(stmt,i)!=5 else None) for i in range(2)])
    assert rows==expected,(sql,rows)
    assert lib.sqlite3_reset(stmt)==0
   print('table compound names:',rows)
  finally:
   if stmt:assert lib.sqlite3_finalize(stmt)==0
 for sql,error in [(base.replace('d."x:1"','d.missing'),'no such column: d.missing')]:
  stmt=P()
  try:
   assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==1
   assert lib.sqlite3_errmsg(db).decode()==error,(sql,lib.sqlite3_errmsg(db))
  finally:
   if stmt:lib.sqlite3_finalize(stmt)
finally:assert lib.sqlite3_close(db)==0
