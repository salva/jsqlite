#!/usr/bin/env python3
import ctypes as C,json,pathlib,struct,sys,os
root=pathlib.Path(__file__).resolve().parents[2];spec=json.load(open(root/'test/conformance/cases/audit-in-list.spec.json'));L=C.CDLL(sys.argv[1]);P=C.c_void_p
sigs=[('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int)]
for n,a,r in sigs:f=getattr(L,n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==spec['sourceId']
def cell(s,i):
 t=L.sqlite3_column_type(s,i)
 if t==5:return{'type':'null'}
 if t==1:return{'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
 if t==2:return{'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(s,i)).hex()}
 n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);b=C.string_at(p,n) if n else b''
 return {'type':'blob','hex':b.hex()} if t==4 else {'type':'text','utf8Hex':b.hex()}
def x(db,q):
 e=C.c_char_p();rc=L.sqlite3_exec(db,q.encode(),None,None,C.byref(e));assert rc==0,(q,rc,e.value,L.sqlite3_errmsg(db))
def init(enc,path):
 try:os.unlink(path)
 except FileNotFoundError:pass
 d=P();assert L.sqlite3_open(os.fsencode(path),C.byref(d))==0;x(d,"PRAGMA encoding='%s'"%enc);[x(d,q) for q in spec['setup']];return d
def run(d,c):
 s=P();tail=C.c_char_p();rc=L.sqlite3_prepare_v2(d,c['sql'].encode(),-1,C.byref(s),C.byref(tail))
 if rc:return{'error':{'phase':'prepare','code':rc,'message':L.sqlite3_errmsg(d).decode()}}
 for i,v in enumerate(c.get('bindings',[]),1):assert L.sqlite3_bind_int64(s,i,v)==0
 cols=[L.sqlite3_column_name(s,i).decode() for i in range(L.sqlite3_column_count(s))];rows=[]
 while (rc:=L.sqlite3_step(s))==100:rows.append([cell(s,i) for i in range(len(cols))])
 out={'columns':cols,'rows':rows} if rc==101 else {'error':{'phase':'step','code':rc,'message':L.sqlite3_errmsg(d).decode()}}
 reset=L.sqlite3_reset(s);L.sqlite3_finalize(s);out['resetCode']=reset;return out
out={'schema':'jsqlite-in-list-audit/1','sourceId':spec['sourceId'],'credit':0,'encodings':{}}
outdir=root/'test/fixtures/in-list';outdir.mkdir(parents=True,exist_ok=True)
for key,enc in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 d=init(enc,str(outdir/f'orders-{key}.db'));out['encodings'][key]={'databaseEncoding':enc,'cases':[{'id':c['id'],'sql':c['sql'],'bindings':c.get('bindings',[]),'native':run(d,c)} for c in spec['cases']]};L.sqlite3_close(d)
print(json.dumps(out,indent=2))
