#!/usr/bin/env python3
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];spec=json.load(open(root/'test/conformance/cases/audit-expression-callers.spec.json'));L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int)]:f=getattr(L,n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==spec['sourceId']
def cell(s,i):
 t=L.sqlite3_column_type(s,i)
 if t==5:return{'type':'null'}
 if t==1:return{'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
 if t==2:return{'type':'real','ieee754be':__import__('struct').pack('>d',L.sqlite3_column_double(s,i)).hex()}
 n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);b=C.string_at(p,n) if n else b'';return {'type':'blob','hex':b.hex()} if t==4 else {'type':'text','utf8Hex':b.hex()}
def capture(c):
 d=P();assert L.sqlite3_open(b':memory:',C.byref(d))==0
 enc={'encoding-utf8':'UTF-8','encoding-utf16le':'UTF-16le','encoding-utf16be':'UTF-16be'}.get(c['fixture'])
 setup=list(c.get('setup',[]));
 if enc:setup.insert(0,f"PRAGMA encoding='{enc}'")
 e=C.c_char_p()
 for q in setup: assert L.sqlite3_exec(d,q.encode(),None,None,C.byref(e))==0,(q,e.value)
 s=P();tail=C.c_char_p();rc=L.sqlite3_prepare_v2(d,c['sql'].encode(),-1,C.byref(s),C.byref(tail))
 if rc:out={'error':{'phase':'prepare','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}}
 else:
  cols=[{'name':L.sqlite3_column_name(s,i).decode()} for i in range(L.sqlite3_column_count(s))];rows=[]
  while (rc:=L.sqlite3_step(s))==100:rows.append([cell(s,i) for i in range(L.sqlite3_column_count(s))])
  out={'columns':cols,'rows':rows} if rc==101 else {'error':{'phase':'step','resultCode':rc,'primaryCode':rc&255,'message':L.sqlite3_errmsg(d).decode()}}
 L.sqlite3_finalize(s);L.sqlite3_close(d);return out
out={'schema':'jsqlite-audit-expression-callers/1','sourceId':spec['sourceId'],'credit':'audit-no-credit','cases':[{**c,'native':capture(c),'ts':{'disposition':'unimplemented-or-mismatch','credit':False}} for c in spec['cases']]};print(json.dumps(out,indent=2))
