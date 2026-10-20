"""Capture retained FROM destination controls with the pinned C API."""
import ctypes as C, pathlib, json, sys, hashlib, base64
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('close',[P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('bind_int64',[P,C.c_int,C.c_int64],C.c_int),('bind_null',[P,C.c_int],C.c_int),('bind_parameter_count',[P],C.c_int),('bind_parameter_name',[P,C.c_int],C.c_char_p),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('column_double',[P,C.c_int],C.c_double),('column_text',[P,C.c_int],C.c_char_p),('errmsg',[P],C.c_char_p)]:
 f=getattr(L,'sqlite3_'+n); f.argtypes=a; f.restype=r
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+n);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
source=L.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
queries=json.loads((root/'docs/research/retained-filter-queries.json').read_text())
images=json.loads(pathlib.Path(sys.argv[2]).read_text())
out={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
for image in images['encodings']:
 path=pathlib.Path(image['file']);data=path.read_bytes();assert hashlib.sha256(data).hexdigest()==image['sha256']
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 cases=[]
 for query in queries:
  spec=query if isinstance(query,dict) else None
  sql=spec['sql'] if spec else query
  st=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);case={'sql':sql,'prepare':rc}
  if rc:case['message']=L.sqlite3_errmsg(db).decode()
  else:
   case['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(L,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(L.sqlite3_column_count(st))]
   case['runs']=[]
   if spec:
    case['parameterCount']=L.sqlite3_bind_parameter_count(st)
    case['parameterNames']=[(L.sqlite3_bind_parameter_name(st,i) or b'').decode() or None for i in range(1,case['parameterCount']+1)]
   for binding in (spec['bindings'] if spec else [2,None,0,7] if '?1' in sql else [None]):
    if spec:
     assert len(binding)==case['parameterCount']
     for i,value in enumerate(binding,1):assert (L.sqlite3_bind_null(st,i) if value is None else L.sqlite3_bind_int64(st,i,value))==0
    elif '?1' in sql:assert (L.sqlite3_bind_null(st,1) if binding is None else L.sqlite3_bind_int64(st,1,binding))==0
    for cycle in range(2):
     rows=[]
     while True:
      rc=L.sqlite3_step(st)
      if rc!=100:break
      row=[]
      for i in range(len(case['metadata'])):
       typ=L.sqlite3_column_type(st,i);assert typ in (1,2,3,5)
       value=None if typ==5 else str(L.sqlite3_column_int64(st,i)) if typ==1 else str(L.sqlite3_column_double(st,i)) if typ==2 else L.sqlite3_column_text(st,i).decode()
       row.append({'type':{1:'integer',2:'real',3:'text',5:'null'}[typ],'value':value})
      rows.append(row)
     run={'binding':binding,'rows':rows,'end':rc}
     if rc!=101:run['message']=L.sqlite3_errmsg(db).decode()
     case['runs'].append(run);assert L.sqlite3_reset(st)==(0 if rc==101 else rc)
   assert L.sqlite3_finalize(st)==0
  cases.append(case)
 assert L.sqlite3_close(db)==0
 out['variants'].append({'encoding':image['encoding'],'sha256':image['sha256'],'base64':base64.b64encode(data).decode(),'cases':cases})
print(json.dumps(out,indent=2))
