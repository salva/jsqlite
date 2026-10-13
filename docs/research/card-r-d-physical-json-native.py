import ctypes as c,json,os,pathlib
l=c.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
p=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(p)],c.c_int),('sqlite3_prepare_v2',[p,c.c_char_p,c.c_int,c.POINTER(p),p],c.c_int),('sqlite3_step',[p],c.c_int),('sqlite3_column_count',[p],c.c_int),('sqlite3_column_type',[p,c.c_int],c.c_int),('sqlite3_column_int64',[p,c.c_int],c.c_longlong),('sqlite3_column_text',[p,c.c_int],c.c_char_p),('sqlite3_finalize',[p],c.c_int),('sqlite3_errmsg',[p],c.c_char_p),('sqlite3_close',[p],c.c_int)]:
 f=getattr(l,name);f.argtypes=args;f.restype=ret
root=pathlib.Path('test/fixtures');g=json.loads((root/'CURRENT.json').read_text())['generationId'];db=p();assert l.sqlite3_open(str(root/'generations'/g/'generated/select4-t1.db').encode(),c.byref(db))==0
sqls=["SELECT t1.n,count(j.atom) FROM t1 LEFT JOIN json_each('[]') j ON 1 GROUP BY t1.n", "SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[]') j ON 1", "SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[1]') j ON j.atom=t1.n WHERE t1.n<3", "SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[1]') j ON 1 WHERE j.atom IS NULL", 'SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each(NULL) j ON 1 WHERE t1.n<3', "SELECT t1.n,j.atom FROM t1 LEFT JOIN json_tree(jsonb('[1]'),'$.missing') j ON 1 WHERE t1.n<3", "SELECT t1.n,j.json,j.root,j.fullkey FROM t1 LEFT JOIN json_each('[]') j ON 1 WHERE t1.n=1", "SELECT count(*),count(j.atom),sum(j.atom) FROM t1 LEFT JOIN json_each('[]') j ON 1", "SELECT t1.n,count(j.atom) FROM t1 LEFT JOIN json_each('[1]') j ON t1.n=j.atom WHERE t1.n<3 GROUP BY t1.n", "SELECT sum(j.atom)+1,count(*) FILTER (WHERE j.atom>1) FROM t1 CROSS JOIN json_each('[1,2]') j WHERE t1.n<3", "SELECT t1.n,count(j.atom) FROM t1 INNER JOIN json_tree(jsonb('[1,2]')) j ON j.atom=t1.n GROUP BY t1.n HAVING count(j.atom)>0"]
for sql in sqls:
 s=p();rc=l.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(s),None);rows=[]
 if rc:print(json.dumps({'sql':sql,'error':l.sqlite3_errmsg(db).decode()}));continue
 while l.sqlite3_step(s)==100:
  row=[]
  for i in range(l.sqlite3_column_count(s)):
   t=l.sqlite3_column_type(s,i);row.append(['integer',str(l.sqlite3_column_int64(s,i))] if t==1 else ['null',None] if t==5 else ['text',l.sqlite3_column_text(s,i).decode()])
  rows.append(row)
 print(json.dumps({'sql':sql,'rows':rows}));l.sqlite3_finalize(s)
l.sqlite3_close(db)
