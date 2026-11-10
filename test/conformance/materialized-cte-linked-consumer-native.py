#!/usr/bin/env python3
"""Pinned public-API controls for the one-retained-source CF01 slice."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]; lib=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,res in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_double',[P,C.c_int],C.c_double),('column_text',[P,C.c_int],C.c_char_p),('column_blob',[P,C.c_int],P),('column_bytes',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('column_type',[P,C.c_int],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int),('bind_int64',[P,C.c_int,C.c_longlong],C.c_int)]:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=res
for name in ['column_name','column_decltype','column_database_name','column_table_name','column_origin_name']:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
prefix='WITH c AS MATERIALIZED (SELECT count(*) AS n FROM t1)'
cases=[(prefix+' SELECT n FROM c',[4]),*( (prefix+' SELECT n FROM c WHERE '+p,[]) for p in ['n<0','n+1<0','NULL']), (prefix+' SELECT n FROM c WHERE 1',[4]),(prefix+' SELECT n+1 AS n FROM c',[5]),(prefix+' SELECT n FROM c WHERE n=?1','bind'),(prefix+' SELECT n FROM c LIMIT 0',[]),(prefix+' SELECT n FROM c LIMIT 1 OFFSET 1',[]),('WITH c AS MATERIALIZED (SELECT a AS n FROM t1 WHERE 0) SELECT n+1 AS n FROM c WHERE n>0',[]),(prefix+" SELECT n FROM c WHERE json_extract('bad','$')",None)]
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 try:
  for sql,expected in cases:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,sql
   try:
    assert [getattr(lib,'sqlite3_'+n)(s,0) for n in ['column_name','column_decltype','column_database_name','column_table_name','column_origin_name']]==[b'n',None,None,None,None],sql
    for value in [4,9]:
     if expected=='bind':assert lib.sqlite3_bind_int64(s,1,value)==0
     rows=[]
     while (rc:=lib.sqlite3_step(s))==100:
      assert lib.sqlite3_column_type(s,0)==1;rows.append(lib.sqlite3_column_int64(s,0))
     if expected is None:assert rc==1;assert lib.sqlite3_reset(s)==1
     else:
      assert rc==101;assert rows==([4] if value==4 else []) if expected=='bind' else rows==expected,(sql,rows)
      assert lib.sqlite3_reset(s)==0
   finally:assert lib.sqlite3_finalize(s)==0
  for sql,expected in [('WITH c AS MATERIALIZED (SELECT a AS n FROM t1 ORDER BY a LIMIT 2) SELECT n AS n FROM c WHERE n>1 LIMIT 1',[3])]:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0
   try:
    assert [getattr(lib,'sqlite3_'+n)(s,0) for n in ['column_name','column_decltype','column_database_name','column_table_name','column_origin_name']]==[b'n',b'INTEGER',b'main',b't1',b'a']
    for _ in range(2):
     rows=[]
     while (rc:=lib.sqlite3_step(s))==100:
      assert lib.sqlite3_column_type(s,0)==1;rows.append(lib.sqlite3_column_int64(s,0))
     assert rc==101 and rows==expected;assert lib.sqlite3_reset(s)==0
   finally:assert lib.sqlite3_finalize(s)==0
  for expr,typ,want,read in [('1.25',2,1.25,lambda s:lib.sqlite3_column_double(s,0)),("'é'",3,'é'.encode(),lambda s:lib.sqlite3_column_text(s,0)),("x'00ff'",4,b'\x00\xff',lambda s:C.string_at(lib.sqlite3_column_blob(s,0),lib.sqlite3_column_bytes(s,0))),('NULL',5,None,lambda s:None)]:
   s=P();sql=f'WITH c AS MATERIALIZED (SELECT {expr} AS n FROM t1 LIMIT 1) SELECT n FROM c';assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0
   try:
    for _ in range(2):
     assert lib.sqlite3_step(s)==100;assert lib.sqlite3_column_type(s,0)==typ;assert read(s)==want;assert lib.sqlite3_step(s)==101;assert lib.sqlite3_reset(s)==0
   finally:assert lib.sqlite3_finalize(s)==0
  # R43: unused CTE expressions execute; ordinary retained demand still prunes.
  for label,sql,error,expected in [
   ('cte-unused',"WITH c AS MATERIALIZED (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 LIMIT 1) SELECT n FROM c",True,[]),
   ('derived-unused',"SELECT n FROM (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 ORDER BY a LIMIT 1) WHERE n>0",False,[1]),
   ('cte-empty',"WITH c AS MATERIALIZED (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 WHERE 0 LIMIT 1) SELECT n FROM c",False,[]),
   ('singleton-derived-unused',"SELECT n FROM (SELECT a AS n,json_extract('bad',char(36)) AS unused FROM t1 LIMIT 1)",False,[1]),
   ('cte-nonfailing','WITH c AS MATERIALIZED (SELECT a AS n,17 AS unused FROM t1 LIMIT 1) SELECT n FROM c',False,[1])]:
   s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,label
   try:
    for cycle in range(2):
     rows=[]
     while (rc:=lib.sqlite3_step(s))==100:
      assert lib.sqlite3_column_type(s,0)==1;rows.append(lib.sqlite3_column_int64(s,0))
     assert rows==expected,(label,rows)
     assert rc==(1 if error else 101),label
     if error:
      lib.sqlite3_errmsg.argtypes=[P];lib.sqlite3_errmsg.restype=C.c_char_p
      assert lib.sqlite3_errmsg(d)==b'malformed JSON'
     assert lib.sqlite3_reset(s)==(1 if error else 0)
   finally:assert lib.sqlite3_finalize(s)==0
  print('PASS R43 unused-expression phase/reset and nonfailing/empty/ordinary-derived controls',enc)
 finally:assert lib.sqlite3_close(d)==0
 print('PASS CF01 linked consumer',enc,len(cases),'cases, five-field metadata/storage/two cycles')
