#!/usr/bin/env python3
"""Native valid-SQL baseline for materialized-cte-filter-containment.test.mjs."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for name,args,res in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('column_type',[P,C.c_int],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int),('bind_int64',[P,C.c_int,C.c_longlong],C.c_int)]:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=res
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 try:
  for producer,values in [('SELECT count(*) AS n FROM t1',[4]),('SELECT row_number() OVER () AS n FROM t1',[1,2,3,4]),('SELECT a AS n FROM t1 UNION SELECT a AS n FROM t1',[1,3,5,7])]:
   for filt,expected in [('n < 0',[]),('n+1 < 0',[]),('NULL',[]),('1',values),("json_extract('bad','$')",None),('n = ?1','bind')]:
    s=P();sql=f'WITH c AS MATERIALIZED ({producer}) SELECT n FROM c WHERE {filt}'
    assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,sql
    try:
     for value in [1,4]:
      if expected=='bind':assert lib.sqlite3_bind_int64(s,1,value)==0
      rows=[]
      while (rc:=lib.sqlite3_step(s))==100:
       assert lib.sqlite3_column_type(s,0)==1;rows.append(lib.sqlite3_column_int64(s,0))
      if expected is None:assert rc==1;assert lib.sqlite3_reset(s)==1
      else:
       assert rc==101;assert rows==([v for v in values if v==value] if expected=='bind' else expected),(sql,rows)
       assert lib.sqlite3_reset(s)==0
    finally:assert lib.sqlite3_finalize(s)==0
 finally:assert lib.sqlite3_close(d)==0
 print('PASS materialized filters native',enc)
