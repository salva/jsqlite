#!/usr/bin/env python3
"""Development-only capture with pinned native library; never used at runtime."""
import ctypes as C, hashlib, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[2]
folder = root / 'examples/browser'
L = C.CDLL(sys.argv[1]); P = C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('close',[P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('step',[P],C.c_int),('finalize',[P],C.c_int),('column_count',[P],C.c_int),('column_name',[P,C.c_int],C.c_char_p),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('column_double',[P,C.c_int],C.c_double),('column_text',[P,C.c_int],P),('column_blob',[P,C.c_int],P),('column_bytes',[P,C.c_int],C.c_int)]:
 f=getattr(L,'sqlite3_'+n); f.argtypes=a; f.restype=r
pin=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert L.sqlite3_sourceid().decode()==pin['sqliteSourceId']
b= (folder/'chinook.sqlite').read_bytes()
descriptor=json.loads((root/'test/fixtures/public/chinook.json').read_text())
assert len(b)==descriptor['bytes'] and hashlib.sha256(b).hexdigest()==descriptor['sha256']
db=P(); assert L.sqlite3_open_v2(str(folder/'chinook.sqlite').encode(),C.byref(db),1,None)==0
cases=[]
for name in ['albums','types']:
 sql=(folder/(name+'.sql')).read_text(); s=P(); tail=C.c_char_p()
 assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),C.byref(tail))==0
 columns=[L.sqlite3_column_name(s,i).decode() for i in range(L.sqlite3_column_count(s))]; rows=[]
 while True:
  rc=L.sqlite3_step(s)
  if rc!=100: assert rc==101; break
  row=[]
  for i in range(len(columns)):
   t=L.sqlite3_column_type(s,i)
   if t==1: cell={'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
   elif t==2: cell={'type':'real','value':L.sqlite3_column_double(s,i)}
   elif t==5: cell={'type':'null','value':None}
   else:
    n=L.sqlite3_column_bytes(s,i); p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i); v=C.string_at(p,n) if n else b''
    cell={'type':'blob' if t==4 else 'text','value':v.hex() if t==4 else v.decode()}
   row.append(cell)
  rows.append(row)
 assert L.sqlite3_finalize(s)==0
 cases.append({'id':name,'sql':sql,'columns':columns,'rows':rows})
assert L.sqlite3_close(db)==0
print(json.dumps({'sourceId':pin['sqliteSourceId'],'fixture':descriptor,'cases':cases},indent=2))
