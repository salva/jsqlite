"""R1 native matrix on existing corrected fixtures; no fixture regeneration."""
import ctypes as C, importlib.util, json, hashlib, sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId'];assert d.sqlite3_libversion().decode()=='3.53.4'
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+n);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
out=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/f'test/fixtures/cte-module-owner/{enc}-corrected.sqlite';db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0;cases=[]
 for case in json.loads((root/'docs/research/cte-json-window-r1.json').read_text()):
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(st),None);a={**case,'prepare':rc}
  if rc==0:
   a['columns']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
   for _ in range(3):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    a['runs'].append({'rows':rows,'end':rc,'error':None if rc==101 else d.sqlite3_errmsg(db).decode()});d.sqlite3_reset(st)
  else:a['error']=d.sqlite3_errmsg(db).decode()
  d.sqlite3_finalize(st);cases.append(a)
 d.sqlite3_close(db);out.append({'encoding':enc,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
print(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':out},indent=2))
