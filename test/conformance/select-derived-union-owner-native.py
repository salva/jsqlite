#!/usr/bin/env python3
"""Source-ID checked public pinned union-all derived coroutine oracle."""
import ctypes as C, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]; L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=ret
assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
sqls=['SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 LIMIT 1 OFFSET 1) d','SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 HAVING count(*)>1) d','SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 HAVING count(*)>0) d','SELECT d.n FROM (SELECT count(*) AS n ORDER BY 1 LIMIT 1 OFFSET 1) d','SELECT d.n FROM (SELECT count(*) AS n ORDER BY n DESC LIMIT 1) d','SELECT d.n FROM (SELECT count(*) AS n HAVING count(*)>1) d','SELECT d.n FROM (SELECT count(*) AS n HAVING count(*)>0) d','SELECT d.n FROM (SELECT count(*) AS n) d','SELECT d.n FROM (SELECT count(*) AS n WHERE 0) d','SELECT d.n FROM (SELECT sum(2) AS n LIMIT 0) d','SELECT d.i FROM (SELECT 7 AS i ORDER BY i LIMIT 1) d','SELECT d.i FROM (SELECT 7 AS i ORDER BY 1 DESC LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT 7 AS i ORDER BY 1 LIMIT 0) d',"SELECT d.i,d.r,d.t,d.b,d.n FROM (SELECT 1 AS i,1.5 AS r,'é' AS t,x'00ff' AS b,NULL AS n UNION ALL SELECT 2,2.5,'z',x'ff',NULL) d",'SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 UNION ALL SELECT 3 LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION SELECT 2) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 EXCEPT SELECT 2) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 INTERSECT SELECT 1) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 EXCEPT SELECT 2 LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 2) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 2 LIMIT 1 OFFSET 2) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 3 LIMIT 1) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 3 LIMIT 2 OFFSET 1) d',"SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' UNION SELECT 'z') d","SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' LIMIT 1 OFFSET 1) d","SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' UNION ALL SELECT 'z') d","SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' EXCEPT SELECT 'z') d",'SELECT d.i FROM (SELECT 2 AS i UNION SELECT NULL UNION SELECT 1.5) d','SELECT d.i FROM (SELECT 2 AS i UNION SELECT NULL UNION SELECT 1.5 LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT NULL AS i UNION SELECT NULL UNION ALL SELECT 1.5) d',"SELECT d.i FROM (SELECT x'ff' AS i UNION SELECT x'00' UNION SELECT x'ff') d","SELECT d.i FROM (SELECT x'ff' AS i EXCEPT SELECT x'ff' UNION ALL SELECT x'00') d",'SELECT d.i FROM (SELECT 1 AS i EXCEPT SELECT 1 UNION ALL SELECT 4) d','SELECT d.i FROM (SELECT 1 AS i INTERSECT SELECT 1 UNION ALL SELECT 4 LIMIT 1 OFFSET 1) d','SELECT d.i FROM (SELECT -2 AS i UNION SELECT 1+1 UNION SELECT 1) d','SELECT d.i FROM (SELECT -2 AS i EXCEPT SELECT -2 UNION ALL SELECT 1+1) d','SELECT d.i FROM (SELECT 1+1 AS i UNION SELECT 2 UNION ALL SELECT 3) d','SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 LIMIT 0) d','SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 LIMIT 1) d LIMIT 0']
def cells(st):
 out=[]
 for i in range(L.sqlite3_column_count(st)):
  t=L.sqlite3_column_type(st,i)
  if t==1:out.append(('integer',L.sqlite3_column_int64(st,i)))
  elif t==2:out.append(('real',L.sqlite3_column_double(st,i)))
  elif t==5:out.append(('null',None))
  else:
   size=L.sqlite3_column_bytes(st,i);p=L.sqlite3_column_blob(st,i) if t==4 else L.sqlite3_column_text(st,i)
   b=C.string_at(p,size) if size else b''
   out.append(('blob',b.hex()) if t==4 else ('text',b.decode()))
 return out
expected=[[],[],[[('integer',1)]],[],[[('integer',1)]],[],[[('integer',1)]],[[('integer',1)]],[[('integer',0)]],[],[[('integer',7)]],[],[],[[('integer',1),('real',1.5),('text','é'),('blob','00ff'),('null',None)],[('integer',2),('real',2.5),('text','z'),('blob','ff'),('null',None)]],[[('integer',2)]],[[('integer',1)],[('integer',2)]],[[('integer',2)]],[[('integer',1)]],[[('integer',1)]],[],[[('integer',1)],[('integer',2)],[('integer',2)]],[[('integer',2)]],[[('integer',1)]],[[('integer',2)],[('integer',3)]],[[('text','a')],[('text','z')]],[[('text','z')]],[[('text','a')],[('text','z')],[('text','z')]],[[('text','a')]],[[('null',None)],[('real',1.5)],[('integer',2)]],[[('real',1.5)]],[[('null',None)],[('real',1.5)]],[[('blob','00')],[('blob','ff')]],[[('blob','00')]],[[('integer',4)]],[[('integer',4)]],[[('integer',-2)],[('integer',1)],[('integer',2)]],[[('integer',2)]],[[('integer',2)],[('integer',3)]],[],[]]
db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
try:
 for sql,want in zip(sqls,expected):
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  try:
   for _ in range(2):
    got=[]
    while True:
     rc=L.sqlite3_step(st)
     if rc==101:break
     assert rc==100,(sql,rc)
     got.append(cells(st))
    assert got==want,(sql,got)
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
 bad=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.missing FROM (SELECT 1 AS i UNION ALL SELECT 2) d',-1,C.byref(bad),None)==1
 assert not bad.value
 bad=P();assert L.sqlite3_prepare_v2(db,b'SELECT d.n FROM (SELECT count(*) AS n ORDER BY 2) d',-1,C.byref(bad),None)==1
 assert not bad.value

finally:assert L.sqlite3_close(db)==0
print(f'pinned derived coroutine oracle: {len(sqls)} typed/reset cases + two prepare errors')
