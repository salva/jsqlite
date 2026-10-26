#!/usr/bin/env python3
"""Pinned read-only mixed JSON controls; exact INTEGER/NULL and metadata."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]; L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name); f.argtypes=args; f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
fields=['name','decltype','database_name','table_name','origin_name']
for name in fields:
 f=getattr(L,'sqlite3_column_'+name); f.argtypes=[P,C.c_int]; f.restype=C.c_char_p
cases=json.loads((root/'test/conformance/cases/select-mixed-json-binding.json').read_text())
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
for encoding in ['utf8','utf16le','utf16be']:
 db=P(); assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/g/f'generated/subquery-{encoding}.db').encode(),C.byref(db),1,None)==0
 try:
  for case in cases:
   stmt=P(); assert L.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(stmt),None)==0,case
   try:
    assert [[getattr(L,'sqlite3_column_'+name)(stmt,i) for name in fields] for i in range(2)]==[[b'a',b'INTEGER',b'main',b't1',b'a'],[b'value',None,b'main',b'json_each',b'value']]
    for cycle in range(2):
     rows=[]
     while True:
      rc=L.sqlite3_step(stmt)
      if rc==101:break
      assert rc==100,rc
      row=[]
      for i in range(2):
       kind=L.sqlite3_column_type(stmt,i); assert kind in (1,5),kind
       row.append(None if kind==5 else L.sqlite3_column_int64(stmt,i))
      rows.append(row)
     assert rows==case['rows'],(case,rows)
     if cycle==0:assert L.sqlite3_reset(stmt)==0
    print(encoding,case['sql'],'rows/types/metadata/reset PASS')
   finally:assert L.sqlite3_finalize(stmt)==0
 finally:assert L.sqlite3_close(db)==0
