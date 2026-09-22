#!/usr/bin/env python3
import ctypes as C,json,pathlib,struct,sys,os,hashlib
root=pathlib.Path(__file__).resolve().parents[2];spec=json.load(open(root/'test/conformance/cases/audit-chinook-b1-b5.spec.json'));lib,chinook=sys.argv[1:3];L=C.CDLL(lib);P=C.c_void_p
S=[('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int)]
for n,a,r in S:f=getattr(L,n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==spec['sourceId'];assert hashlib.sha256(open(chinook,'rb').read()).hexdigest()==spec['chinook']['sha256']
def cell(s,i):
 t=L.sqlite3_column_type(s,i)
 if t==5:return{'type':'null'}
 if t==1:return{'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
 if t==2:return{'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(s,i)).hex()}
 n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);b=C.string_at(p,n) if n else b''
 return {'type':'blob','hex':b.hex()} if t==4 else {'type':'text','utf8Hex':b.hex()}
def run(d,c):
 s=P();tail=C.c_char_p();rc=L.sqlite3_prepare_v2(d,c['sql'].encode(),-1,C.byref(s),C.byref(tail))
 if rc:return{'error':{'phase':'prepare','code':rc,'message':L.sqlite3_errmsg(d).decode()}}
 for i,v in enumerate(c.get('bindings',[]),1):assert L.sqlite3_bind_int64(s,i,v)==0
 cols=[L.sqlite3_column_name(s,i).decode() for i in range(L.sqlite3_column_count(s))];rows=[]
 while (rc:=L.sqlite3_step(s))==100:rows.append([cell(s,i) for i in range(len(cols))])
 out={'columns':cols,'rows':rows} if rc==101 else {'columns':cols,'error':{'phase':'step','code':rc,'message':L.sqlite3_errmsg(d).decode()}}
 out['resetCode']=L.sqlite3_reset(s);L.sqlite3_finalize(s);return out
def open_db(p):d=P();assert L.sqlite3_open(os.fsencode(p),C.byref(d))==0;return d
def x(d,q):e=C.c_char_p();rc=L.sqlite3_exec(d,q.encode(),None,None,C.byref(e));assert rc==0,(q,rc,e.value)
outdir=root/'test/fixtures/chinook-b1-b5';outdir.mkdir(parents=True,exist_ok=True);dbs={}
for key,enc in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 p=outdir/f'synthetic-{key}.db'
 try:p.unlink()
 except FileNotFoundError:pass
 d=open_db(p);x(d,"PRAGMA encoding='%s'"%enc)
 for q in spec['setup']:x(d,q)
 dbs[key]=d
ch=open_db(chinook);out={'schema':'jsqlite-chinook-b1-b5/1','sourceId':spec['sourceId'],'credit':0,'executions':[]}
for c in spec['cases']:
 keys=['chinook'] if c['fixture']=='chinook' else ['utf8','utf16le','utf16be']
 for key in keys:out['executions'].append({'encoding':'UTF-8' if key=='chinook' else {'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[key],**c,'native':run(ch if key=='chinook' else dbs[key],c)})
for d in [ch,*dbs.values()]:L.sqlite3_close(d)
print(json.dumps(out,indent=2))
