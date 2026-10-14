import ctypes as C,json,sys,pathlib,hashlib
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_decltype',[P,C.c_int],C.c_char_p),('sqlite3_column_database_name',[P,C.c_int],C.c_char_p),('sqlite3_column_table_name',[P,C.c_int],C.c_char_p),('sqlite3_column_origin_name',[P,C.c_int],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p)]:
 f=getattr(L,n);f.argtypes=args;f.restype=ret
source=L.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
root=pathlib.Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
ddl='CREATE TABLE t(a int,b InTeGeR,c "TeXt",d CuStOm,e "MiXeD type",f,g real GENERATED ALWAYS AS (a+1) VIRTUAL); INSERT INTO t(a,b,c,d,e,f) VALUES(1,2,3,4,5,6); CREATE TABLE st(a int,b text) STRICT; INSERT INTO st VALUES(7,8); CREATE VIEW v AS SELECT a AS alias,d,f,g FROM t;'
sqls=['SELECT a AS alias,b,c,d,e,f,g,1 AS expr FROM t','SELECT * FROM st','SELECT * FROM v','SELECT sql FROM sqlite_schema ORDER BY name','SELECT a.a AS left_name,b.a AS right_name FROM t a CROSS JOIN t b']
variants=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 file=root/(encoding+'.db');file.unlink(missing_ok=True);db=P();assert L.sqlite3_open_v2(str(file).encode(),C.byref(db),6,None)==0
 assert L.sqlite3_exec(db,("PRAGMA encoding='"+encoding+"';"+ddl).encode(),None,None,None)==0
 cases=[]
 for sql in sqls:
  s=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),C.byref(tail))==0
  metadata=[]
  for i in range(L.sqlite3_column_count(s)):
   metadata.append(dict(zip(['name','declaredType','database','table','origin'],[None if (v:=getattr(L,n)(s,i)) is None else v.decode() for n in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']])))
  passes=[]
  for repeat in range(2):
   rows=[]
   while (rc:=L.sqlite3_step(s))==100:
    rows.append([{'type':'null'} if (t:=L.sqlite3_column_type(s,i))==5 else {'type':'integer','value':str(L.sqlite3_column_int64(s,i))} if t==1 else {'type':'real','value':L.sqlite3_column_double(s,i)} if t==2 else {'type':'text','value':L.sqlite3_column_text(s,i).decode()} for i in range(L.sqlite3_column_count(s))])
   assert rc==101;passes.append(rows);assert L.sqlite3_reset(s)==0
  assert passes[0]==passes[1];assert L.sqlite3_finalize(s)==0;cases.append({'sql':sql,'metadata':metadata,'rows':passes[0]})
 assert L.sqlite3_close(db)==0
 variants.append({'encoding':encoding,'fixture':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'cases':cases})
print(json.dumps({'sourceId':source,'ddl':ddl,'variants':variants},indent=2))
