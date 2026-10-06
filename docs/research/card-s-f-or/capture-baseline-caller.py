import ctypes,json,os,pathlib
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']);c=w/'scoped-or-delivery/candidate';l=ctypes.CDLL(str(w/'scoped-or-delivery/oracle-build/build/libsqlite3-oracle.so'));P=ctypes.c_void_p
for n,args,ret in [('sqlite3_open_v2',[ctypes.c_char_p,ctypes.POINTER(P),ctypes.c_int,P],ctypes.c_int),('sqlite3_prepare_v2',[P,ctypes.c_char_p,ctypes.c_int,ctypes.POINTER(P),P],ctypes.c_int),('sqlite3_step',[P],ctypes.c_int),('sqlite3_column_int64',[P,ctypes.c_int],ctypes.c_longlong),('sqlite3_column_type',[P,ctypes.c_int],ctypes.c_int),('sqlite3_column_count',[P],ctypes.c_int),('sqlite3_bind_int64',[P,ctypes.c_int,ctypes.c_longlong],ctypes.c_int),('sqlite3_bind_text',[P,ctypes.c_int,ctypes.c_char_p,ctypes.c_int,P],ctypes.c_int),('sqlite3_reset',[P],ctypes.c_int),('sqlite3_clear_bindings',[P],ctypes.c_int),('sqlite3_finalize',[P],ctypes.c_int),('sqlite3_close',[P],ctypes.c_int),('sqlite3_sourceid',[],ctypes.c_char_p)]:f=getattr(l,n);f.argtypes=args;f.restype=ret
sqls=[('derived',"SELECT (SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT ?1) d WHERE d.y>?2) AS filtered, EXISTS(SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT ?1) d WHERE d.y>?2) AS present, 3 IN (SELECT d.y FROM (SELECT x+1 AS y FROM t2 LIMIT ?1) d WHERE d.y>?2) AS member",[[1,2],[2,2],[0,2],None]),('affinity',"SELECT ?1 IN (SELECT a FROM t1) AS bound, '1' IN (SELECT a FROM t1) AS text, 1.0 IN (SELECT a FROM t1) AS real",[['1'],['99'],[1],None])]
out={'sourceId':l.sqlite3_sourceid().decode(),'variants':[]};gen=json.load(open(c/'test/fixtures/CURRENT.json'))['generationId']
for enc in ['utf8','utf16le','utf16be']:
 db=P();assert l.sqlite3_open_v2(str(c/f'test/fixtures/generations/{gen}/generated/subquery-{enc}.db').encode(),ctypes.byref(db),1,None)==0;v={'encoding':enc,'cases':[]}
 for name,sql,runs in sqls:
  st=P();assert l.sqlite3_prepare_v2(db,sql.encode(),-1,ctypes.byref(st),None)==0;case={'id':name,'sql':sql,'runs':[]}
  for binds in runs:
   l.sqlite3_reset(st);l.sqlite3_clear_bindings(st)
   if binds:
    for i,val in enumerate(binds,1):
     assert (l.sqlite3_bind_text(st,i,val.encode(),-1,P(-1)) if isinstance(val,str) else l.sqlite3_bind_int64(st,i,val))==0
   rows=[]
   while True:
    rc=l.sqlite3_step(st)
    if rc==101:break
    if rc!=100:break
    rows.append([{'type':'null' if l.sqlite3_column_type(st,i)==5 else 'integer','value':None if l.sqlite3_column_type(st,i)==5 else str(l.sqlite3_column_int64(st,i))} for i in range(l.sqlite3_column_count(st))])
   case['runs'].append({'bindings':binds,'rows':rows,'stepCode':rc})
  l.sqlite3_finalize(st);v['cases'].append(case)
 l.sqlite3_close(db);out['variants'].append(v)
(c/'docs/research/card-s-f-or/baseline-caller-native.json').write_text(json.dumps(out,indent=2)+'\n');print('native24 bound executions captured',out['sourceId'])
