#!/usr/bin/env python3
"""Pinned joined outer scalar NameContext identity and errors."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];fixture=root/'test/fixtures/generations'/g/'generated/subquery-utf8.db'
lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:f=getattr(lib,name);f.argtypes=args;f.restype=result
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
base='SELECT t.a,(SELECT count(*) FROM t1 AS i WHERE i.c={}) AS n FROM t1 AS t JOIN t1 AS u ON u.a=t.a WHERE t.a IN (1,5) ORDER BY 1'
db=P();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 for field,expected in [('t.c',[[(1,1),(1,2)],[(1,5),(1,0)]]),('u.c',[[(1,1),(1,2)],[(1,5),(1,0)]])]:
  sql=base.format(field);stmt=P()
  try:
   assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,(sql,lib.sqlite3_errmsg(db));assert [lib.sqlite3_column_name(stmt,i).decode() for i in range(lib.sqlite3_column_count(stmt))]==['a','n']
   for _ in range(2):
    rows=[]
    while (rc:=lib.sqlite3_step(stmt))!=101:
     assert rc==100,(sql,rc,lib.sqlite3_errmsg(db));rows.append([(lib.sqlite3_column_type(stmt,i),lib.sqlite3_column_int64(stmt,i)) for i in range(2)])
    assert rows==expected,(sql,rows);assert lib.sqlite3_reset(stmt)==0
   print('joined NULL:',rows)
  finally:assert lib.sqlite3_finalize(stmt)==0
 for sql,error in [(base.format('t.missing'),'no such column: t.missing'),(base.format('t.c').replace('FROM t1 AS i WHERE i.c=t.c','FROM t1 AS i JOIN t1 AS j WHERE c=t.c'),'ambiguous column name: c')]:
  stmt=P()
  try:
   assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==1
   assert lib.sqlite3_errmsg(db).decode()==error,lib.sqlite3_errmsg(db)
  finally:
   if stmt:lib.sqlite3_finalize(stmt)
finally:assert lib.sqlite3_close(db)==0
