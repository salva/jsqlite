"""Pinned W172 owner regressions: root output-dir library. Native before public."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('oracle',root/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]);source=d.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
queries=[
 "SELECT (SELECT q.vb FROM v1 q WHERE q.vb>2 ORDER BY q.vb DESC LIMIT 1) AS high, EXISTS(SELECT q.vc FROM v1 q WHERE q.vb>9) AS absent, 6 IN (SELECT q.vb FROM v1 q WHERE q.vb>2) AS member",
 "SELECT 6 IN (SELECT DISTINCT q.vb FROM v1 q WHERE q.vb>2) AS member",
 "SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each('[4,5]') j WHERE EXISTS(SELECT 1 FROM json_each(json_array(j.value)) k WHERE k.value=5)) AS hit",
 "SELECT EXISTS(SELECT 1 FROM t1 CROSS JOIN json_each('[4,5]') j WHERE EXISTS(SELECT 1 FROM json_each(json_array(j.value)) k WHERE k.value=9)) AS miss",
 "SELECT (SELECT abs(-9223372036854775808) FROM v1 LIMIT 0) AS lazy",
 "SELECT (SELECT abs(-9223372036854775808) FROM v1) AS required",
]
generation=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];variants=[]
for enc in ['utf8','utf16le','utf16be']:
 cases=[]
 for family,sqls in [('subquery',queries[:2]+queries[4:]),('encoding',queries[2:4])]:
  p=root/'test/fixtures/generations'/generation/'generated'/f'{family}-{enc}.db';raw=p.read_bytes()
  db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
  for sql in sqls:
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
   metadata=[]
   for i in range(d.sqlite3_column_count(st)):
    metadata.append({key:(v.decode() if (v:=getattr(d,'sqlite3_column_'+native)(st,i)) else None) for key,native in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]})
   runs=[]
   for _ in range(2):
    rows=[]
    while (rc:=d.sqlite3_step(st))==100:rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    run={'rows':rows,'end':rc,'reset':d.sqlite3_reset(st)}
    if rc!=101:run['error']=d.sqlite3_errmsg(db).decode()
    runs.append(run)
   d.sqlite3_finalize(st);cases.append({'family':family,'fixtureSha256':hashlib.sha256(raw).hexdigest(),'sql':sql,'metadata':metadata,'runs':runs})
  assert d.sqlite3_close(db)==0
 variants.append({'encoding':enc,'cases':cases})
(out/'native.json').write_text(json.dumps({'generation':generation,'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'variants':variants},indent=2)+'\n')
