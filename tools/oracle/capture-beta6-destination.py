"""Pinned C API controls for grouped/ungrouped destination guard union."""
import ctypes as C, json, pathlib, sys, base64, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
images=json.loads((root/'docs/research/card-e-n-pragma-red/scalar-filter-native.json').read_text())
queries=json.loads((root/'docs/research/beta6-destination-queries.json').read_text())
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('close',[P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('bind_int64',[P,C.c_int,C.c_int64],C.c_int),('bind_null',[P,C.c_int],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('errmsg',[P],C.c_char_p)]:
 f=getattr(L,'sqlite3_'+n); f.argtypes=a; f.restype=r
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+n);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
source=L.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']==images['sourceId']
work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
out={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
for image in images['encodings']:
 data=base64.b64decode(image['base64']);assert hashlib.sha256(data).hexdigest()==image['sha256']
 path=work/(image['encoding']+'.sqlite');path.write_bytes(data); db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 cases=[]
 for sql in queries:
  st=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);case={'sql':sql,'prepare':rc}
  if rc:case['message']=L.sqlite3_errmsg(db).decode()
  else:
   meta=[]
   for i in range(L.sqlite3_column_count(st)):
    vals=[getattr(L,'sqlite3_column_'+n)(st,i) for n in ['name','decltype','database_name','table_name','origin_name']]
    meta.append(dict(zip(['name','declaredType','database','table','origin'],[v.decode() if v is not None else None for v in vals])))
   case['metadata']=meta;case['runs']=[]
   for binding in ([7,None,2,7] if '?1' in sql else [None]):
    if '?1' in sql:assert (L.sqlite3_bind_null(st,1) if binding is None else L.sqlite3_bind_int64(st,1,binding))==0
    for cycle in range(2):
     rows=[]
     while True:
      rc=L.sqlite3_step(st)
      if rc!=100:break
      row=[]
      for i in range(len(meta)):
       typ=L.sqlite3_column_type(st,i);assert typ in (1,5)
       row.append({'type':'null' if typ==5 else 'integer','value':None if typ==5 else str(L.sqlite3_column_int64(st,i))})
      rows.append(row)
     run={'binding':binding,'rows':rows,'end':rc}
     if rc!=101:run['message']=L.sqlite3_errmsg(db).decode()
     case['runs'].append(run);assert L.sqlite3_reset(st)==(0 if rc==101 else rc)
   assert L.sqlite3_finalize(st)==0
  cases.append(case)
 assert L.sqlite3_close(db)==0
 out['variants'].append({'encoding':image['encoding'],'sha256':image['sha256'],'cases':cases})
print(json.dumps(out,indent=2))
