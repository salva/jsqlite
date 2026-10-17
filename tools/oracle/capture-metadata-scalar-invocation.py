"""Independent finite scalar invocation oracle; random() is an observable counter.
SQLite permits replacing built-ins with sqlite3_create_function. Public TS uses
an injected non-secret crypto source instead, leaving SQL/compiler code untouched.
"""
import ctypes as C, json, pathlib, sys, base64, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
images=json.loads((root/'docs/research/card-e-n-pragma-red/scalar-filter-native.json').read_text())
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('close',[P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('bind_text',[P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),('step',[P],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('result_int64',[P,C.c_int64],None)]:
 f=getattr(L,'sqlite3_'+n);f.argtypes=a;f.restype=r
assert L.sqlite3_sourceid().decode()==manifest['sqliteSourceId']==images['sourceId']
CB=C.CFUNCTYPE(None,P,C.c_int,P)
L.sqlite3_create_function.argtypes=[P,C.c_char_p,C.c_int,C.c_int,P,CB,P,P];L.sqlite3_create_function.restype=C.c_int
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
queries=[
 ('once','SELECT x,(SELECT count(*)+sum(cid)+random() FROM pragma_table_info(?1)) AS a FROM t'),
 ('correlated','SELECT x,(SELECT count(*)+sum(cid)+random() FROM pragma_table_info(t.nm)) AS a FROM t WHERE ?1 IS NOT NULL'),
 ('conditional','SELECT x,CASE WHEN x=2 THEN (SELECT count(*)+sum(cid)+random() FROM pragma_table_info(?1)) ELSE 0 END AS a FROM t'),
 ('skipped','SELECT x,CASE WHEN x=99 THEN (SELECT count(*)+sum(cid)+random() FROM pragma_table_info(?1)) ELSE 0 END AS a FROM t')]
work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
out={'sourceId':images['sourceId'],'variants':[]}
for image in images['encodings']:
 data=base64.b64decode(image['base64']);assert hashlib.sha256(data).hexdigest()==image['sha256']
 path=work/(image['encoding']+'.sqlite');path.write_bytes(data);db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 counter=[0]
 @CB
 def random(ctx,argc,argv):
  counter[0]+=1;L.sqlite3_result_int64(ctx,counter[0])
 assert L.sqlite3_create_function(db,b'random',0,1,None,random,None,None)==0
 cases=[]
 for name,sql in queries:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  metadata=[]
  for i in range(2):
   values=[]
   for n in ['name','decltype','database_name','table_name','origin_name']:
    v=getattr(L,'sqlite3_column_'+n)(st,i);values.append(v.decode() if v is not None else None)
   metadata.append(dict(zip(['name','declaredType','database','table','origin'],values)))
  runs=[]
  for binding in ['t','missing','u','t']:
   assert L.sqlite3_bind_text(st,1,binding.encode(),-1,P(-1))==0
   for cycle in range(2):
    counter[0]=0;rows=[]
    while True:
     rc=L.sqlite3_step(st)
     if rc!=100:break
     types=[L.sqlite3_column_type(st,i) for i in range(2)];assert all(t in (1,5) for t in types)
     rows.append([None if types[i]==5 else str(L.sqlite3_column_int64(st,i)) for i in range(2)])
    assert rc==101;assert L.sqlite3_reset(st)==0
    runs.append({'binding':binding,'rows':rows,'calls':counter[0]})
  assert L.sqlite3_finalize(st)==0;cases.append({'name':name,'sql':sql,'metadata':metadata,'runs':runs})
 assert L.sqlite3_close(db)==0
 out['variants'].append({'encoding':image['encoding'],'sha256':image['sha256'],'cases':cases})
print(json.dumps(out,indent=2))
