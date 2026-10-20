"""Read-only pinned oracle for bounded linked-consumer controls. Args: root work lib."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib, base64
root=pathlib.Path(sys.argv[1]); work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]);source=d.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
arm='SELECT t.x,u.x FROM t JOIN u ON t.x=u.x'
throwing='SELECT abs(-9223372036854775808),u.x FROM t JOIN u ON t.x=u.x'
queries=[f'SELECT ({arm} UNION ALL {arm})',f'SELECT 2 IN ({arm} UNION ALL {arm})',f'SELECT (2,2) IN ({arm} UNION ALL {arm})',f'SELECT EXISTS({arm} UNION ALL {arm})',f'SELECT EXISTS({arm} UNION ALL {arm} LIMIT 0)',f'SELECT EXISTS({arm} UNION ALL {arm}) FROM t a',f'SELECT (2,2) IN ({arm} UNION ALL {arm}) FROM t a','SELECT EXISTS(SELECT t.x,u.x FROM t JOIN u ON t.x=u.x WHERE t.x=a.x UNION ALL SELECT t.x,u.x FROM t JOIN u ON t.x=u.x WHERE t.x=a.x) FROM t a',throwing+' UNION SELECT missing,u.x FROM t JOIN u ON t.x=u.x',throwing+' UNION ALL '+arm,'SELECT d.x,u.x FROM (SELECT x FROM t ORDER BY x DESC LIMIT 1) d JOIN u ON d.x=u.x WHERE d.x<3 UNION ALL SELECT d.x,u.x FROM (SELECT x FROM t ORDER BY x DESC LIMIT 1) d JOIN u ON d.x=u.x WHERE d.x<3']
variants=[]
for v in json.loads((root/'docs/research/join-retained-compound-native.json').read_text())['encodings']:
 raw=base64.b64decode(v['base64']);assert hashlib.sha256(raw).hexdigest()==v['sha256'];p=work/(v['encoding']+'.sqlite');p.write_bytes(raw)
 db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0;cases=[]
 for sql in queries:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);item={'sql':sql,'prepare':rc}
  if rc:item['error']=d.sqlite3_errmsg(db).decode()
  else:
   item['runs']=[]
   for _ in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    run={'rows':rows,'end':rc}
    if rc!=101:run['error']=d.sqlite3_errmsg(db).decode()
    run['reset']=d.sqlite3_reset(st);item['runs'].append(run)
   d.sqlite3_finalize(st)
  cases.append(item)
 d.sqlite3_close(db);variants.append({'encoding':v['encoding'],'fixtureSha256':v['sha256'],'cases':cases})
print(json.dumps({'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'encodings':variants},indent=2))
