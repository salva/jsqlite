"""Pinned read-only expanded compound width oracle. Args: root work lib."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib, base64
root=pathlib.Path(sys.argv[1]);work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]);source=d.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
queries=[]
for width in [2,3]:
 child='x' if width==2 else 'x,nm'
 for fields in ['*','d.*,u.x']:
  left=f'SELECT {fields} FROM (SELECT {child} FROM t ORDER BY x DESC LIMIT 2) d JOIN u ON d.x=u.x'
  right='SELECT t.x,u.x FROM t JOIN u ON t.x=u.x' if width==2 else 'SELECT t.x,t.nm,u.x FROM t JOIN u ON t.x=u.x'
  for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
   queries.append(left+' '+op+' '+right)
   queries.append(left+' '+op+' SELECT u.x FROM u')
variants=[]
for v in json.loads((root/'docs/research/join-retained-compound-native.json').read_text())['encodings']:
 raw=base64.b64decode(v['base64']);assert hashlib.sha256(raw).hexdigest()==v['sha256'];p=work/(v['encoding']+'.sqlite');p.write_bytes(raw)
 db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0;cases=[]
 for sql in queries:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);item={'sql':sql,'prepare':rc}
  if rc:item['error']=d.sqlite3_errmsg(db).decode()
  else:
   item['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))]
   item['runs']=[]
   for _ in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    assert rc==101;assert d.sqlite3_reset(st)==0;item['runs'].append({'rows':rows,'end':rc})
   d.sqlite3_finalize(st)
  cases.append(item)
 assert d.sqlite3_close(db)==0;variants.append({'encoding':v['encoding'],'fixtureSha256':v['sha256'],'cases':cases})
print(json.dumps({'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'encodings':variants},indent=2))
