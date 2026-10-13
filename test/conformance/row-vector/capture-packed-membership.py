#!/usr/bin/env python3
import ctypes as C,json,pathlib,struct,sys,os
# Run from project root with the pinned metadata-enabled SQLite shared library.
root=pathlib.Path.cwd();spec=json.load(open(root/'test/conformance/row-vector/spec.json'));L=C.CDLL(sys.argv[1]);P=C.c_void_p
sigs=[('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_extended_errcode',[P],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int)]
for field in ['decltype','database_name','table_name','origin_name']:sigs.append(('sqlite3_column_'+field,[P,C.c_int],C.c_char_p))
for n,a,r in sigs:f=getattr(L,n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==spec['sourceId']
def cell(s,i):
 t=L.sqlite3_column_type(s,i)
 if t==5:return{'type':'null'}
 if t==1:return{'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
 if t==2:return{'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(s,i)).hex()}
 n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);b=C.string_at(p,n) if n else b''
 return {'type':'blob','hex':b.hex()} if t==4 else {'type':'text','utf8Hex':b.hex()}
output={'sourceId':L.sqlite3_sourceid().decode(),'encodings':{}}
queries=json.load(open(root/'test/conformance/row-vector/packed-membership-queries.json'))
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert L.sqlite3_open(os.fsencode(root/('test/fixtures/row-vector/pairs-'+enc+'.db')),C.byref(d))==0
 cases=[]
 for q in queries:
  st=P();rc=L.sqlite3_prepare_v2(d,q.encode(),-1,C.byref(st),None);assert rc==0,(q,rc,L.sqlite3_errmsg(d))
  columns=[]
  for i in range(L.sqlite3_column_count(st)):
   fields={}
   for name,api in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    v=getattr(L,'sqlite3_column_'+api)(st,i);fields[name]=v.decode() if v else None
   columns.append(fields)
  runs=[]
  for run in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(st)
    if rc!=100:break
    rows.append([cell(st,i) for i in range(L.sqlite3_column_count(st))])
   assert rc==101,(q,rc,L.sqlite3_errmsg(d));runs.append(rows);assert L.sqlite3_reset(st)==0
  assert L.sqlite3_finalize(st)==0;cases.append({'sql':q,'columns':columns,'runs':runs})
 assert L.sqlite3_close(d)==0;output['encodings'][enc]=cases
print(json.dumps(output,indent=2))
