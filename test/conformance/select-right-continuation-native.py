#!/usr/bin/env python3
"""Pinned public scalar RIGHT continuation output-break oracle."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(P)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:f=getattr(L,n);f.argtypes=args;f.restype=ret
root=pathlib.Path(__file__).resolve().parents[2];assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
path=root/'test/conformance/fixtures/advanced-index-utf8.db'
db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
cases=[('SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT 1 OFFSET 0),1', [(2, 1)]), ('SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT 1 OFFSET 6),1', [(4, 1)]), ('SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT 1 OFFSET 7),1', [(5, 1)]), ('SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT 1 OFFSET 8),1', [(None, 1)]), ('SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT 0 OFFSET 0),1', [(None, 1)])]
cases += [
 ('SELECT x.id,y.id FROM m x RIGHT JOIN m y ON x.id=y.id AND x.id<3 WHERE y.id IN (1,4,5) ORDER BY y.id',[(1,1),(None,4),(None,5)]),
 ('SELECT y.id,z.id FROM m x RIGHT JOIN m y ON x.id=-1 LEFT JOIN m z ON z.id=y.id AND z.id<3 WHERE y.id IN (1,4,5) ORDER BY y.id',[(1,1),(4,None),(5,None)]),
 ('SELECT y.id,z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a IN (1,2) AND z.b>=2 WHERE y.id=4 ORDER BY z.id LIMIT 2 OFFSET 1',[(4,3),(4,4)]),
]

try:
 for sql,want in cases:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  try:
   for _ in range(2):
    got=[]
    while (rc:=L.sqlite3_step(st))==100:
     types=tuple(L.sqlite3_column_type(st,i) for i in range(2))
     assert all(t in (1,5) for t in types),(sql,types)
     got.append(tuple(None if types[i]==5 else L.sqlite3_column_int64(st,i) for i in range(2)))
    assert rc==101 and got==want,(sql,got,want)
    assert L.sqlite3_reset(st)==0
  finally:assert L.sqlite3_finalize(st)==0
finally:assert L.sqlite3_close(db)==0
print('pinned RIGHT downstream selected continuation: 8 cases x2 reset')
