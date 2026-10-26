#!/usr/bin/env python3
"""Pinned 3.53.4 repeated nonflattenable view/derived-source oracle."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]; L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];db=P()
for name in ['sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']:
 f=getattr(L,name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/g/'generated/subquery-utf8.db').encode(),C.byref(db),1,None)==0
try:
 for sql,expected in [(b'SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1',[(1,1),(3,3),(5,5)]),(b'SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1 LIMIT 2 OFFSET 1',[(3,3),(5,5)]),(b'SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1 LIMIT 0',[])]:
  s=P();assert L.sqlite3_prepare_v2(db,sql,-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   assert L.sqlite3_column_count(s)==2
   assert [L.sqlite3_column_name(s,i) for i in range(2)]==[b'a',b'a']
   assert [[getattr(L,name)(s,i) for name in ['sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']] for i in range(2)]==[[b'INTEGER',b'main',b't1',b'a']]*2
   for _ in range(2):
    rows=[]
    while (rc:=L.sqlite3_step(s))==100:
     assert [L.sqlite3_column_type(s,i) for i in range(2)]==[1,1]
     rows.append(tuple(L.sqlite3_column_int64(s,i) for i in range(2)))
    assert rc==101,(rc,L.sqlite3_errmsg(db));assert rows==expected,(sql,rows)
    assert L.sqlite3_reset(s)==0
   print(sql.decode(),expected)
  finally:assert L.sqlite3_finalize(s)==0
 bad=P();rc=L.sqlite3_prepare_v2(db,b'SELECT x.missing FROM v_limited x JOIN v_limited y ON x.a=y.a',-1,C.byref(bad),None)
 assert rc==1 and L.sqlite3_errmsg(db)==b'no such column: x.missing',(rc,L.sqlite3_errmsg(db))
 if bad:assert L.sqlite3_finalize(bad)==0
finally:assert L.sqlite3_close(db)==0

# Stored explicit column-list mismatch must resolve even under empty consumers.
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
for encoding in ['utf8','utf16le','utf16be']:
 db=P();assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/g/f'generated/subquery-{encoding}.db').encode(),C.byref(db),1,None)==0
 try:
  s=P();assert L.sqlite3_prepare_v2(db,b'SELECT x.vb,x.vc FROM (SELECT * FROM v1 ORDER BY vb LIMIT 3) x ORDER BY 1',-1,C.byref(s),None)==0,L.sqlite3_errmsg(db)
  try:
   assert [L.sqlite3_column_name(s,i) for i in range(2)]==[b'vb',b'vc']
   assert [[getattr(L,name)(s,i) for name in ['sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']] for i in range(2)]==[[b'INTEGER',b'main',b't1',b'b'],[b'TEXT',b'main',b't1',b'c']]
   for _ in range(2):
    rows=[]
    while (rc:=L.sqlite3_step(s))==100:
     types=[L.sqlite3_column_type(s,i) for i in range(2)]
     rows.append((types,L.sqlite3_column_int64(s,0),L.sqlite3_column_text(s,1)))
    assert rc==101 and rows==[([1,3],2,b'Alpha'),([1,3],4,b'alpha'),([1,5],6,None)],rows
    assert L.sqlite3_reset(s)==0
  finally:assert L.sqlite3_finalize(s)==0
  for sql in [b'SELECT * FROM v_bad LIMIT 0',b'SELECT x.only_one FROM v_bad x JOIN v_bad y ON 1 LIMIT 0']:
   bad=P();rc=L.sqlite3_prepare_v2(db,sql,-1,C.byref(bad),None)
   assert rc==1 and L.sqlite3_errmsg(db)==b"expected 1 columns for 'v_bad' but got 2",(rc,L.sqlite3_errmsg(db))
   if bad:assert L.sqlite3_finalize(bad)==0
   reuse=P();assert L.sqlite3_prepare_v2(db,b'SELECT 1',-1,C.byref(reuse),None)==0
   assert L.sqlite3_step(reuse)==100 and L.sqlite3_column_int64(reuse,0)==1
   assert L.sqlite3_step(reuse)==101
   assert L.sqlite3_finalize(reuse)==0
  print(encoding,'definition errors/reuse passed')
 finally:assert L.sqlite3_close(db)==0
