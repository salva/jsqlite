"""Pinned native-first witnesses for retained SrcItem -> AggInfo coroutine."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib, os
root=pathlib.Path(os.environ['COMMON_CHECKPOINT_OUTPUT']);root.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',pathlib.Path('test/conformance/capture-index-planner.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
import subprocess
queries=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {retainedGroupQueries} from './test/conformance/retained-group-cases.mjs'; console.log(JSON.stringify(retainedGroupQueries))"],text=True))
images=[]
for e in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(e+'.sqlite');assert not p.exists();db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 for q in [f"PRAGMA encoding='{e}'",'CREATE TABLE t(x INTEGER)', 'INSERT INTO t VALUES(1),(2),(3),(NULL)']:m.execsql(d,db,q)
 d.sqlite3_close(db);db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for q in queries:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);a={'sql':q,'prepare':rc}
  if rc==0:
   a['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
   for repeat in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    a['runs'].append({'rows':rows,'end':rc,'error':d.sqlite3_errmsg(db).decode() if rc!=101 else None});d.sqlite3_reset(st)
   d.sqlite3_finalize(st)
  else:a['error']=d.sqlite3_errmsg(db).decode()
  cases.append(a)
 d.sqlite3_close(db);images.append({'encoding':e,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(root/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':images},indent=2))
