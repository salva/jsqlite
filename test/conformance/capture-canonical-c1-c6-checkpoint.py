import ctypes as C,json,pathlib,sys,hashlib,struct
lib,dbfile,cases=sys.argv[1:];L=C.CDLL(lib);P=C.c_void_p
for n,args,ret in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:f=getattr(L,n);f.argtypes=args;f.restype=ret
assert 'bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc' in L.sqlite3_sourceid().decode();assert hashlib.sha256(pathlib.Path(dbfile).read_bytes()).hexdigest()=='7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15'
db=P();assert L.sqlite3_open_v2(dbfile.encode(),C.byref(db),1,None)==0
out=[]
for item in json.loads(pathlib.Path(cases).read_text()):
 st=P();rc=L.sqlite3_prepare_v2(db,item['sql'].encode(),-1,C.byref(st),None);assert rc==0,(item,rc);names=[L.sqlite3_column_name(st,i).decode() for i in range(L.sqlite3_column_count(st))];rows=[]
 while (rc:=L.sqlite3_step(st))==100:
  row=[]
  for i in range(len(names)):
   t=L.sqlite3_column_type(st,i);text=L.sqlite3_column_text(st,i);v=None if t==5 else str(L.sqlite3_column_int64(st,i)) if t==1 else struct.pack('>d',L.sqlite3_column_double(st,i)).hex() if t==2 else text.decode();row.append({'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t],'value':v,'text':None if text is None else text.decode()})
  rows.append(row)
 assert rc==101,(item,rc);L.sqlite3_finalize(st);out.append({**item,'names':names,'rows':rows})
L.sqlite3_close(db);print(json.dumps(out,indent=2))
