import ctypes as C, json, pathlib, sys, tempfile, hashlib
# Read-only independent oracle over the exact existing fixture bytes.
root=pathlib.Path(__file__).resolve().parents[2]
receipt=json.loads((root/'docs/research/card-e-n-pragma-red/scalar-filter-native.json').read_text())
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,res in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('bind_text',[P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),('bind_null',[P,C.c_int],C.c_int),('step',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(L,'sqlite3_'+name);f.argtypes=args;f.restype=res
assert L.sqlite3_sourceid().decode()==receipt['sourceId']
sql="SELECT (SELECT count(*)+sum(p.cid) FROM pragma_table_info(?1) p WHERE p.cid IN (SELECT q.cid FROM pragma_table_info(?1) q)) AS a"
result={'sourceId':receipt['sourceId'],'sql':sql,'variants':[]}
import base64
# All disposable image files live in the caller-specified card work directory.
work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
for image in receipt['encodings']:
 data=base64.b64decode(image['base64']);assert hashlib.sha256(data).hexdigest()==image['sha256']
 path=work/(image['encoding']+'.sqlite');path.write_bytes(data)
 db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 runs=[]
 for binding in ['t','u','missing',None,'t']:
  raw=None if binding is None else binding.encode()
  assert (L.sqlite3_bind_null(st,1) if raw is None else L.sqlite3_bind_text(st,1,raw,-1,P(-1)))==0
  cycles=[]
  for _ in range(2):
   assert L.sqlite3_step(st)==100
   typ=L.sqlite3_column_type(st,0);assert typ in (1,5)
   cell=None if typ==5 else str(L.sqlite3_column_int64(st,0))
   assert L.sqlite3_step(st)==101;assert L.sqlite3_reset(st)==0
   cycles.append({'type':'null'} if typ==5 else {'type':'integer','value':cell})
  runs.append({'binding':binding,'cycles':cycles})
 assert L.sqlite3_finalize(st)==0;assert L.sqlite3_close(db)==0
 result['variants'].append({'encoding':image['encoding'],'sha256':image['sha256'],'runs':runs})
print(json.dumps(result,indent=2))
