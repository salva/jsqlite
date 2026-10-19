"""Development-only pinned jsonEachFilter admission/root receipt; no product imports."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[2]
exec((root/'tools/oracle/capture-json-result-metadata.py').read_text().split("result={'sourceId'")[0])
L.sqlite3_errmsg.argtypes=[P];L.sqlite3_errmsg.restype=C.c_char_p
result={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
roots=['123',"X'24'","X'2400'","X'0024'",'NULL',"'$'||char(0)||'bad'","'$.a'||char(0)||'bad'","'bad'",'1.5',"'$'"]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=root/'test/fixtures/cte-module-owner'/f'{enc}-corrected.sqlite';db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 for module in ['json_each','json_tree','jsonb_each','jsonb_tree']:
  for doc in ["'[1]'",'NULL',"'malformed'","jsonb('[1]')"]:
   for rootSql in roots:
    sql=f'SELECT value,type,atom,json,root FROM {module}({doc},{rootSql})';st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
    columns=[dict(zip(['name','declaredType','database','table','origin'],[string(getattr(L,'sqlite3_column_'+f)(st,i)) for f in ['name','decltype','database_name','table_name','origin_name']])) for i in range(L.sqlite3_column_count(st))]
    rows=[]
    while True:
     rc=L.sqlite3_step(st)
     if rc!=100:break
     rows.append([cell(st,i) for i in range(len(columns))])
    error=None if rc==101 else L.sqlite3_errmsg(db).decode()
    assert L.sqlite3_reset(st)==(0 if rc==101 else rc)
    assert L.sqlite3_finalize(st)==0
    result['variants'].append({'encoding':enc,'sql':sql,'rows':rows,'error':error,'code':None if rc==101 else rc,'columns':columns,'fixtureSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 assert L.sqlite3_close(db)==0
print(json.dumps(result,indent=2))
