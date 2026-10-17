import ctypes as c,json,os,pathlib
root=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']);l=c.CDLL(str(root/'oracle-build/build/libsqlite3-oracle.so'));p=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(p)],c.c_int),('sqlite3_prepare_v2',[p,c.c_char_p,c.c_int,c.POINTER(p),p],c.c_int),('sqlite3_step',[p],c.c_int),('sqlite3_column_count',[p],c.c_int),('sqlite3_column_type',[p,c.c_int],c.c_int),('sqlite3_column_int64',[p,c.c_int],c.c_longlong),('sqlite3_column_text',[p,c.c_int],c.c_char_p),('sqlite3_finalize',[p],c.c_int),('sqlite3_close',[p],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(l,name);f.argtypes=args;f.restype=ret
print(json.dumps({'sourceid':l.sqlite3_sourceid().decode()}));db=p();assert l.sqlite3_open(b':memory:',c.byref(db))==0
for line in (root/'lazy-column-red/public.jsonl').read_text().splitlines():
 case=json.loads(line);sql=case['sql'];out={'encoding':case['encoding'],'module':case['module'],'binary':case['binary'],'kind':case['kind']}
 for explain in [False,True]:
  s=p();rc=l.sqlite3_prepare_v2(db,('EXPLAIN '+sql if explain else sql).encode(),-1,c.byref(s),None);assert rc==0,rc;rows=[]
  while True:
   rc=l.sqlite3_step(s)
   if rc!=100:break
   row=[]
   for i in range(l.sqlite3_column_count(s)):
    t=l.sqlite3_column_type(s,i);row.append([t,str(l.sqlite3_column_int64(s,i)) if t==1 else l.sqlite3_column_text(s,i).decode() if t==3 else None])
   rows.append(row)
  out['explain' if explain else 'rows']=rows;out['explain_rc' if explain else 'rc']=rc;l.sqlite3_finalize(s)
 print(json.dumps(out))
l.sqlite3_close(db)
