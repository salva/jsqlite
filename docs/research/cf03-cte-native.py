import ctypes as C,json,pathlib,sys,hashlib
r=pathlib.Path(sys.argv[1]);lib=pathlib.Path(sys.argv[2]);assert hashlib.sha256(lib.read_bytes()).hexdigest()=='979c43433a9a9cdfbaaf6bae7dc0fe53eff80b05112aa40d9febfa381c00d020'
l=C.CDLL(str(lib));P=C.c_void_p
for n,a,t in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(l,'sqlite3_'+n);f.argtypes=a;f.restype=t
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(l,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert l.sqlite3_sourceid().decode()==json.loads((r/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
cases=[
 ('having0','WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 0 UNION ALL SELECT count(*) FROM t1)',[4]),
 ('having1','WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1)',[4]),
 ('stop',"WITH c AS MATERIALIZED (SELECT a FROM t1 LIMIT 2) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT json_extract('bad','$') FROM t1)",[2]),
 ('offset','WITH c AS MATERIALIZED (SELECT a FROM t1 LIMIT 2) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1 LIMIT 1 OFFSET 1)',[4]),
 ('zero','WITH c AS MATERIALIZED (SELECT a FROM t1 LIMIT 2) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1 LIMIT 0)',[None]),
 ('aggregate','WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT count(*) AS left_count FROM c HAVING 1 UNION ALL SELECT count(*) AS right_count FROM t1',[4,4]),
 ('origin','WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT a AS left_a FROM c UNION ALL SELECT count(*) AS right_count FROM t1',[1,3,5,7,4]),
 ('error',"WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 0 UNION ALL SELECT json_extract('bad','$') FROM t1)",None),
]
g=json.loads((r/'test/fixtures/CURRENT.json').read_text())['generationId']
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert l.sqlite3_open_v2(str(r/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 try:
  for label,sql,want in cases:
   s=P();assert l.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,(label,sql)
   try:
    meta=[]
    for name in ['name','decltype','database_name','table_name','origin_name']:
     b=getattr(l,'sqlite3_column_'+name)(s,0);meta.append(b.decode() if b else None)
    for cycle in range(2):
     rows=[]
     while (rc:=l.sqlite3_step(s))==100:
      t=l.sqlite3_column_type(s,0);assert t in [1,5];rows.append(None if t==5 else l.sqlite3_column_int64(s,0))
     if want is None:assert rc==1;assert l.sqlite3_reset(s)==1
     else:assert rc==101 and rows==want,(label,rc,rows);assert l.sqlite3_reset(s)==0
    print(json.dumps([enc,label,meta,rows,rc]),flush=True)
   finally:l.sqlite3_finalize(s)
 finally:l.sqlite3_close(d)
