#!/usr/bin/env python3
"""Pinned public scalar-width and COLLATE callback controls."""
import ctypes as C
import json
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[2]
lib = C.CDLL(sys.argv[1]); P = C.c_void_p
for name,args,result in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('errmsg',[P],C.c_char_p),('bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=result
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(lib,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
valid=['SELECT (SELECT 1) COLLATE binary','SELECT abs((SELECT 1))','SELECT ((SELECT 1))','SELECT (SELECT 1,2)=(1,2)','SELECT 1 IN (SELECT 1)','SELECT (SELECT ?1) COLLATE binary AS v','SELECT abs((SELECT ?1) COLLATE binary) AS v']
invalid=['SELECT (SELECT 1,2) COLLATE binary','SELECT abs((SELECT 1,2))','SELECT ((SELECT 1,2))']
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 try:
  for sql in valid:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,sql
   try:
    metadata=[getattr(lib,'sqlite3_column_'+n)(s,0) for n in ['name','decltype','database_name','table_name','origin_name']]
    assert metadata==[(b'v' if '?1' in sql else sql[7:].encode()),None,None,None,None],metadata
    for value in [1,7]:
     if '?1' in sql:assert lib.sqlite3_bind_int64(s,1,value)==0
     assert lib.sqlite3_step(s)==100
     assert lib.sqlite3_column_type(s,0)==1
     assert lib.sqlite3_column_int64(s,0)==(value if '?1' in sql else 1)
     assert lib.sqlite3_step(s)==101
     assert lib.sqlite3_reset(s)==0
   finally:assert lib.sqlite3_finalize(s)==0
  for sql in invalid:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==1
   assert lib.sqlite3_errmsg(d).decode()=='sub-select returns 2 columns - expected 1'
   assert not s.value
  print(enc, 'PASS: 7 valid two-cycle metadata/storage/reset/bind controls; 3 prepare errors')
 finally:assert lib.sqlite3_close(d)==0
