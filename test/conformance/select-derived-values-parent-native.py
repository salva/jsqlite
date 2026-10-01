#!/usr/bin/env python3
"""Pinned select.c:multiSelectValues/derived coroutine, public differential pair."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,result in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=result
assert L.sqlite3_sourceid().decode()==source
sql="SELECT v.column1 AS n,v.column2 AS t,v.column3 AS b,v.column4 AS r FROM (VALUES(1,'a',x'00',1.5),(2,NULL,x'ff',2),(3,'z',x'7f',3)) AS v ORDER BY 1 DESC LIMIT 2"
def cell(stmt,i):
 t=L.sqlite3_column_type(stmt,i)
 if t==1:return ('integer',L.sqlite3_column_int64(stmt,i))
 if t==2:return ('real',L.sqlite3_column_double(stmt,i))
 if t==5:return ('null',None)
 size=L.sqlite3_column_bytes(stmt,i)
 ptr=L.sqlite3_column_blob(stmt,i) if t==4 else L.sqlite3_column_text(stmt,i)
 b=C.string_at(ptr,size) if size else b''
 return ('blob',b.hex()) if t==4 else ('text',b.decode('utf8'))
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 stmt=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0,L.sqlite3_errmsg(db)
 try:
  assert [L.sqlite3_column_name(stmt,i).decode() for i in range(L.sqlite3_column_count(stmt))]==['n','t','b','r']
  expected=[[('integer',3),('text','z'),('blob','7f'),('integer',3)],[('integer',2),('null',None),('blob','ff'),('integer',2)]]
  for _ in range(2):
   got=[]
   while True:
    rc=L.sqlite3_step(stmt)
    if rc==101:break
    assert rc==100,(rc,L.sqlite3_errmsg(db))
    got.append([cell(stmt,i) for i in range(4)])
   assert got==expected,(got,expected)
   assert L.sqlite3_reset(stmt)==0
  print('derived VALUES pinned',got)
 finally: assert L.sqlite3_finalize(stmt)==0
 invalid=P();bad=b'SELECT v.missing FROM (VALUES(1),(2)) v';assert L.sqlite3_prepare_v2(db,bad,-1,C.byref(invalid),None)==1
 assert not invalid.value and b'no such column' in L.sqlite3_errmsg(db)
finally:assert L.sqlite3_close(db)==0
