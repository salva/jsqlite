#!/usr/bin/env python3
"""Pinned public counterpart to function-descriptor-resolution.test.mjs."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,result in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('errmsg',[P],C.c_char_p),('bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=result
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(lib,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
errors=[('SELECT CoNcAt()','wrong number of arguments to function CoNcAt()'),('SELECT CoNcAt_Ws(1)','wrong number of arguments to function CoNcAt_Ws()'),('SELECT NoSuchPolicyFn(1)','no such function: NoSuchPolicyFn'),('SELECT NoSuchPolicyFn(missing)','no such column: missing'),('SELECT abs(missing,2)','no such column: missing'),('SELECT min(1,2) OVER ()','min() may not be used as a window function'),('SELECT max(1,2) OVER ()','max() may not be used as a window function'),('SELECT abs(1) FILTER (WHERE 1)','FILTER may not be used with non-aggregate abs()'),('SELECT abs(1) OVER ()','abs() may not be used as a window function')]
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 try:
  for sql,message in errors:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==1,sql
   assert lib.sqlite3_errmsg(d).decode()==message,sql
   assert not s.value
  for expr in ['min(?1)','max(?1)','min(?1,9)','max(?1,0)','abs(?1)']:
   s=P();assert lib.sqlite3_prepare_v2(d,f'SELECT {expr} AS v'.encode(),-1,C.byref(s),None)==0
   try:
    assert [getattr(lib,'sqlite3_column_'+n)(s,0) for n in ['name','decltype','database_name','table_name','origin_name']]==[b'v',None,None,None,None]
    for value in [1,7]:
     assert lib.sqlite3_bind_int64(s,1,value)==0
     assert lib.sqlite3_step(s)==100
     assert lib.sqlite3_column_type(s,0)==1
     assert lib.sqlite3_column_int64(s,0)==value
     assert lib.sqlite3_step(s)==101
     assert lib.sqlite3_reset(s)==0
   finally:assert lib.sqlite3_finalize(s)==0
  print(enc,'PASS: 9 diagnostics, 5 metadata/storage/two-cycle rebind controls')
 finally:assert lib.sqlite3_close(d)==0
