#!/usr/bin/env python3
"""Finite review32 storage/correlation controls, pinned SQLite public API."""
import ctypes as C
import json
import pathlib
import sys
root = pathlib.Path(__file__).resolve().parents[2]
lib = C.CDLL(sys.argv[1])
P = C.c_void_p
for name, args, result in [
 ('sourceid', [], C.c_char_p), ('open_v2', [C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),
 ('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
 ('step',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),
 ('column_int64',[P,C.c_int],C.c_longlong),('column_double',[P,C.c_int],C.c_double),
 ('column_text',[P,C.c_int],C.c_char_p),('column_blob',[P,C.c_int],P),('column_bytes',[P,C.c_int],C.c_int),
 ('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 fn=getattr(lib,'sqlite3_'+name);fn.argtypes=args;fn.restype=result
for name in ['name','decltype','database_name','table_name','origin_name']:
 fn=getattr(lib,'sqlite3_column_'+name);fn.argtypes=[P,C.c_int];fn.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
cases=[
 ('case-children',"SELECT d.v,d.r FROM (SELECT CASE WHEN a=1 THEN a WHEN a=3 THEN NULL ELSE a+0.5 END AS v,row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r"),
 ('mixed-window',"SELECT d.v,d.r FROM (SELECT CASE a WHEN 1 THEN NULL WHEN 3 THEN x'00ff' WHEN 5 THEN 2.5 ELSE 'z' END AS v,row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.v"),
 ('scalar','SELECT t.a,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS x,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS y FROM t1 t ORDER BY t.a'),
 ('exists','SELECT t.a,EXISTS(SELECT 1 FROM t1 u WHERE u.a<t.a) AS x,EXISTS(SELECT 1 FROM t1 u WHERE u.a<t.a) AS y FROM t1 t ORDER BY t.a'),
 ('in','SELECT t.a,t.a IN (SELECT u.a FROM t1 u WHERE u.a<t.a) AS x,t.a IN (SELECT u.a FROM t1 u WHERE u.a<t.a) AS y FROM t1 t ORDER BY t.a'),
 ('json',"SELECT type,count(*),sum(atom) FROM json_each('[1,2,\"x\",4]') GROUP BY type"),
]
def cell(stmt,i):
 t=lib.sqlite3_column_type(stmt,i)
 if t==1:return ['integer',str(lib.sqlite3_column_int64(stmt,i))]
 if t==2:return ['real',lib.sqlite3_column_double(stmt,i)]
 if t==3:return ['text',lib.sqlite3_column_text(stmt,i).decode()]
 if t==4:return ['blob',list(C.string_at(lib.sqlite3_column_blob(stmt,i),lib.sqlite3_column_bytes(stmt,i)))]
 assert t==5
 return ['null',None]
for encoding in ['utf8','utf16le','utf16be']:
 db=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{generation}/generated/subquery-{encoding}.db').encode(),C.byref(db),1,None)==0
 try:
  for name,sql in cases:
   stmt=P();tail=C.c_char_p();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),C.byref(tail))==0,(name,encoding)
   try:
    n=lib.sqlite3_column_count(stmt)
    metadata=[[getattr(lib,'sqlite3_column_'+field)(stmt,i).decode() if getattr(lib,'sqlite3_column_'+field)(stmt,i) is not None else None for field in ['name','decltype','database_name','table_name','origin_name']] for i in range(n)]
    previous=None
    for cycle in range(2):
     rows=[]
     while True:
      rc=lib.sqlite3_step(stmt)
      if rc==101:break
      assert rc==100,(name,rc)
      rows.append([cell(stmt,i) for i in range(n)])
     if cycle:assert rows==previous
     previous=rows
     assert lib.sqlite3_reset(stmt)==0
    print(json.dumps({'encoding':encoding,'name':name,'sql':sql,'metadata':metadata,'rows':rows,'reset':'PASS'}))
   finally:assert lib.sqlite3_finalize(stmt)==0
 finally:assert lib.sqlite3_close(db)==0
