#!/usr/bin/env python3
"""Independently check the bounded SRT_Output probe against the pinned source ID."""
import ctypes as C
import json
import pathlib
import sys

ROOT=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,result in [
 ('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),
 ('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),
 ('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),
 ('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),
 ]:
    f=getattr(L,name);f.argtypes=args;f.restype=result
assert L.sqlite3_sourceid().decode()==source
cases=[
 ('SELECT 1 AS a, 2.0 AS b, NULL AS n',['a','b','n'],[[(1,1),(2,2.0),(5,None)]]),
 ('SELECT 1 AS v LIMIT 0',['v'],[]),
 ('SELECT 7 AS v UNION ALL SELECT 8 LIMIT 1 OFFSET 1',['v'],[[(1,8)]]),
]
for sql,names,expected in cases:
    db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
    stmt=P()
    try:
        assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)==0
        actualNames=[L.sqlite3_column_name(stmt,i).decode() for i in range(L.sqlite3_column_count(stmt))]
        assert actualNames==names,(sql,actualNames)
        for _ in range(2):
            rows=[]
            while True:
                rc=L.sqlite3_step(stmt)
                if rc==101: break
                assert rc==100,(sql,rc)
                rows.append([(t,L.sqlite3_column_int64(stmt,i) if t==1 else L.sqlite3_column_double(stmt,i) if t==2 else None) for i in range(len(names)) if (t:=L.sqlite3_column_type(stmt,i))])
            assert rows==expected,(sql,rows)
            assert L.sqlite3_reset(stmt)==0
        print(json.dumps({'sql':sql,'names':names,'rows':expected,'sourceId':source}))
    finally:
        if stmt:assert L.sqlite3_finalize(stmt)==0
        assert L.sqlite3_close(db)==0
