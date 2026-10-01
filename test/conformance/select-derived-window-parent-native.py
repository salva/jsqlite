#!/usr/bin/env python3
"""Pinned 3.53.4 materialized FROM window source and outer destination boundary."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];L=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];db=P()
assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/g/'generated/subquery-utf8.db').encode(),C.byref(db),1,None)==0
try:
 for sql in [b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 2 OFFSET 1',b'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 0']:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(s)==1 and L.sqlite3_column_name(s,0)==b'r'
   for run in range(2):
    rows=[]
    while True:
     rc=L.sqlite3_step(s)
     if rc==101:break
     assert rc==100,L.sqlite3_errmsg(db)
     assert L.sqlite3_column_type(s,0)==1
     rows.append(L.sqlite3_column_int64(s,0))
    if run==0:print(sql.decode(),rows)
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
 bad=P();rc=L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1',-1,C.byref(bad),None)
 print('missing',rc,L.sqlite3_errmsg(db));assert rc==1 and not bad.value
finally:assert L.sqlite3_close(db)==0
