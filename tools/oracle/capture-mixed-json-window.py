"""Pinned development-only direct JSON Window capture (no product imports)."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,res in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('column_double',[P,C.c_int],C.c_double),('column_bytes',[P,C.c_int],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(L,'sqlite3_'+name);f.argtypes=args;f.restype=res
for name in ['name','decltype','database_name','table_name','origin_name','text','blob']:
 f=getattr(L,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=P
source=L.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
def string(p):return C.string_at(p).decode() if p else None
def cell(st,i):
 t=L.sqlite3_column_type(st,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(L.sqlite3_column_int64(st,i))}
 if t==2:
  import struct
  return {'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(st,i)).hex()}
 p=(L.sqlite3_column_text if t==3 else L.sqlite3_column_blob)(st,i);n=L.sqlite3_column_bytes(st,i)
 return {'type':'text','value':C.string_at(p,n).decode()} if t==3 else {'type':'blob','hex':C.string_at(p,n).hex()}
result={'sourceId':source,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=root/'test/fixtures/cte-module-owner'/f'{enc}-corrected.sqlite'
 db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 for module in ['json_each','json_tree','jsonb_each','jsonb_tree']:
  for binary in [False,True]:
   input="'[1,2.5,null,9223372036854775807]'"
   if binary:input=f'jsonb({input})'
   leaf="j.type NOT IN ('array','object')"
   cases={
    'exact':f"SELECT s.name,j.value,sum(j.value) OVER () AS total FROM sqlite_schema s JOIN {module}('[1,2]') j ORDER BY s.name,j.key",
    'typed':f"SELECT s.name,j.key,j.value,j.atom,j.json,j.root,j.rowid,sum(j.value) OVER (PARTITION BY s.name ORDER BY j.key ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS total FROM sqlite_schema s JOIN {module}({input}) j WHERE {leaf} ORDER BY s.name,j.key",
    'left':f"SELECT s.name,j.value,j.rowid,count(j.value) OVER () AS n FROM sqlite_schema s LEFT JOIN {module}('[]') j ON j.key=0 ORDER BY s.name",
    'correlated':f"SELECT s.name,j.value,row_number() OVER (ORDER BY s.name,j.key) AS rn FROM sqlite_schema s JOIN {module}(json_array(s.name)) j WHERE {leaf} ORDER BY s.name,j.key",
    'readiness':f"SELECT s.name,j.value,sum(j.value) OVER () AS n FROM sqlite_schema s LEFT JOIN {module}('[1,2]') j ON j.key=0 WHERE j.value=1 ORDER BY s.name",
    'empty':f"SELECT s.name,j.value,sum(j.value) OVER () FROM sqlite_schema s JOIN {module}('[]') j WHERE {leaf}",
    'physical-empty':f"SELECT s.name,j.value,sum(j.value) OVER () FROM sqlite_schema s JOIN {module}({input}) j WHERE s.name='no_such_schema_object'",
   }
   for shape,sql in cases.items():
    st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
    columns=[dict(zip(['name','declaredType','database','table','origin'],[string(getattr(L,'sqlite3_column_'+f)(st,i)) for f in ['name','decltype','database_name','table_name','origin_name']])) for i in range(L.sqlite3_column_count(st))]
    runs=[]
    for _ in range(3):
     rows=[]
     while True:
      rc=L.sqlite3_step(st)
      if rc!=100:break
      rows.append([cell(st,i) for i in range(len(columns))])
     assert rc==101;assert L.sqlite3_reset(st)==0;runs.append(rows)
    assert L.sqlite3_finalize(st)==0
    result['variants'].append({'encoding':enc,'fixtureSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'module':module,'shape':shape,'binary':binary,'sql':sql,'columns':columns,'runs':runs})
 assert L.sqlite3_close(db)==0
print(json.dumps(result,indent=2))
