import ctypes as C,json,sys,hashlib
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,args,ret in [('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_decltype',[P,C.c_int],C.c_char_p),('sqlite3_column_database_name',[P,C.c_int],C.c_char_p),('sqlite3_column_table_name',[P,C.c_int],C.c_char_p),('sqlite3_column_origin_name',[P,C.c_int],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p)]:
 f=getattr(L,n);f.argtypes=args;f.restype=ret
source=L.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
db=P();assert L.sqlite3_open_v2(sys.argv[2].encode(),C.byref(db),1,None)==0
cases=[]
for suffix in ['LIMIT 1','LIMIT 0','LIMIT 1 OFFSET 1','WHERE 0 LIMIT 1']:
 sql='SELECT a.x,b.x FROM t1 AS a CROSS JOIN t1 AS b '+suffix;s=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),C.byref(tail))==0
 meta=[]
 for i in range(L.sqlite3_column_count(s)):
  meta.append([None if (v:=getattr(L,n)(s,i)) is None else v.decode() for n in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']])
 rows=[]
 while (rc:=L.sqlite3_step(s))==100:rows.append([{'type':L.sqlite3_column_type(s,i),'value':str(L.sqlite3_column_int64(s,i))} for i in range(2)])
 assert rc==101;assert L.sqlite3_finalize(s)==0;cases.append({'sql':sql,'metadata':meta,'rows':rows,'done':rc})
assert L.sqlite3_close(db)==0
print(json.dumps({'sourceId':source,'fixtureSha256':hashlib.sha256(open(sys.argv[2],'rb').read()).hexdigest(),'cases':cases},indent=2))
