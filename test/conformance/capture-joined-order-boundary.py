#!/usr/bin/env python3
"""Finite read-only partial/full joined ORDER controls using existing m fixtures."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=m.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+n);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
out={'sourceId':pin['sqliteSourceId'],'variants':[]}
for v in json.loads((ROOT/'test/conformance/cases/stage3-advanced-index.json').read_text())['variants']:
 file=v['fixture']['path'];db=C.c_void_p();assert d.sqlite3_open_v2(str(ROOT/file).encode(),C.byref(db),1,None)==0
 cases=[]
 for kind,sql in [
  ('partial', 'SELECT x.a,y.b FROM m x INDEXED BY m_abc CROSS JOIN m y INDEXED BY m_abc WHERE y.a=1 ORDER BY x.a,y.b DESC'),
  ('full', 'SELECT x.id,y.b FROM m x NOT INDEXED CROSS JOIN m y INDEXED BY m_abc WHERE y.a=1 ORDER BY x.id,y.b DESC')]:
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  metadata=[{n:(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']} for i in range(2)]
  runs=[]
  for _ in range(2):
   assert d.sqlite3_reset(st)==0;d.sqlite3_stmt_status(st,2,1);rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==100:rows.append([m.cell(d,st,i) for i in range(2)])
    else:break
   assert rc==101;runs.append({'rows':rows,'sortCount':d.sqlite3_stmt_status(st,2,0)})
  assert d.sqlite3_finalize(st)==0
  cases.append({'kind':kind,'sql':sql,'metadata':metadata,'runs':runs,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[]),'program':m.explain(d,db,'EXPLAIN ',sql,[])})
 assert d.sqlite3_close(db)==0
 out['variants'].append({'id':v['id'],'fixture':{'path':file,'sha256':hashlib.sha256((ROOT/file).read_bytes()).hexdigest()},'cases':cases})
pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
print('Captured partial/full joined ORDER: 2 SQL x 3 encodings x 2 reset runs')
