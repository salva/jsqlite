"""Development-only pinned C API parameter/metadata/reset receipt."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
# Reuse the independent C API type/metadata capture definitions, not TS output.
exec((root/'tools/oracle/capture-json-result-metadata.py').read_text().split("result={'sourceId'")[0])
for name,args,res in [('bind_parameter_count',[P],C.c_int),('bind_parameter_name',[P,C.c_int],C.c_char_p),('bind_text',[P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),('clear_bindings',[P],C.c_int)]:
 f=getattr(L,'sqlite3_'+name);f.argtypes=args;f.restype=res
shapes=[
 ('input','SELECT count(*),sum(atom) FROM json_each(?1)'),
 ('anonymous','SELECT count(*),sum(atom) FROM json_each(?)'),
 ('numbered','SELECT count(*),sum(atom) FROM json_each(?3)'),
 ('named','SELECT count(*),sum(atom)+length(:doc) FROM json_each(:doc)'),
 ('where','SELECT count(*),sum(atom) FROM json_each(?1) WHERE atom>?2'),
 ('group','SELECT type,sum(atom) FROM json_each(?1) GROUP BY type HAVING sum(atom)>?2'),
 ('result','SELECT sum(atom)+?2 FROM json_each(?1)'),
 ('subquery','SELECT (SELECT sum(atom) FROM json_each(?1)) FROM json_each(?2)'),
 ('window','SELECT atom,sum(atom) OVER () FROM json_each(?1)'),
]
result={'sourceId':source,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=root/'test/fixtures/cte-module-owner'/f'{enc}-corrected.sqlite';db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 for shape,sql in shapes:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  count=L.sqlite3_bind_parameter_count(st);names=[string(L.sqlite3_bind_parameter_name(st,i)) for i in range(1,count+1)]
  columns=[dict(zip(['name','declaredType','database','table','origin'],[string(getattr(L,'sqlite3_column_'+f)(st,i)) for f in ['name','decltype','database_name','table_name','origin_name']])) for i in range(L.sqlite3_column_count(st))]
  runs=[]
  for values in [None,['[1,2,4]']*count,['[1,2,4]']*count,['[2,8]']*count,None]:
   assert L.sqlite3_clear_bindings(st)==0
   if values:
    if shape in ['where','group','result']:values[1]='1'
    for i,v in enumerate(values,1):assert L.sqlite3_bind_text(st,i,v.encode(),-1,P(-1))==0
   rows=[]
   while True:
    rc=L.sqlite3_step(st)
    if rc!=100:break
    rows.append([cell(st,i) for i in range(len(columns))])
   assert rc==101;assert L.sqlite3_reset(st)==0;runs.append({'bindings':values,'rows':rows})
  assert L.sqlite3_finalize(st)==0
  result['variants'].append({'encoding':enc,'shape':shape,'sql':sql,'count':count,'names':names,'columns':columns,'runs':runs,'fixtureSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 assert L.sqlite3_close(db)==0
print(json.dumps(result,indent=2))
