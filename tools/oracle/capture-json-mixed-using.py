#!/usr/bin/env python3
"""Development-only pinned oracle expansion over the authenticated lead fixtures."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);assert d.sqlite3_sourceid().decode()==json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
names=['name','decltype','database_name','table_name','origin_name']
for name in names:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
r=ROOT/'docs/research/json-mixed-using';n=json.loads((r/'native.json').read_text())
sqls=[
 "SELECT key,j.key FROM jt JOIN json_each('[\"x\",\"y\"]') j USING(key) ORDER BY jt.id",
 "SELECT key,j.value FROM jt JOIN json_each('{\"0\":1,\"1\":2}') j USING(key) ORDER BY jt.id",
 "SELECT j.key,j.value FROM jt LEFT JOIN json_each(jt.js) j USING(key) WHERE jt.id=1 AND j.value>99",
 'SELECT key,j.key,jt.id,j.id FROM jt JOIN json_each(jt.js) j USING(key) ORDER BY jt.id',
 'SELECT jt.*,j.* FROM jt LEFT JOIN json_each(jt.js) j USING(key) ORDER BY jt.id',
 'SELECT * FROM jt NATURAL LEFT JOIN json_each(jt.js) j ORDER BY jt.id',
 'SELECT id,key,j.id,j.key FROM jt NATURAL LEFT JOIN json_each(jt.js) j ORDER BY jt.id',
 'SELECT key,j.value FROM jt LEFT JOIN json_each(jt.js) j USING(key) WHERE j.value>15 ORDER BY jt.id',
 'SELECT * FROM jt JOIN json_each(jt.js) j USING(key,id) ORDER BY jt.id',
 'SELECT * FROM jt JOIN json_each(jt.js) j USING(missing)',
 'SELECT id FROM jt JOIN json_each(jt.js) j USING(key)',
 'SELECT * FROM jt NATURAL JOIN json_each(jt.js) j ON 1',
 "SELECT key,j.value FROM jt LEFT JOIN json_each(NULL) j USING(key) ORDER BY jt.id",
 "SELECT key,j.value FROM jt LEFT JOIN json_each('[]') j USING(key) ORDER BY jt.id",
 'SELECT key,j.value FROM jt LEFT JOIN json_each(jsonb(jt.js)) j USING(key) ORDER BY jt.id',
 "SELECT a.key,b.value FROM jt a JOIN json_tree(a.js) b USING(key) ORDER BY a.id,b.id",
 "SELECT key COLLATE nocase AS k,j.value FROM jt JOIN json_each(jt.js) j USING(key) ORDER BY k",
 'SELECT json,root FROM jt NATURAL JOIN json_each(jt.js) j ORDER BY jt.id',
 'SELECT * FROM jt JOIN json_each(jt.js) j USING(key) ORDER BY 4 DESC',
]
sqls+= [q.replace('json_each(',module+'(') for module in ['json_tree','jsonb_each','jsonb_tree'] for q in [
 'SELECT * FROM jt JOIN json_each(jt.js) j USING(key) ORDER BY jt.id,j.key',
 'SELECT * FROM jt NATURAL LEFT JOIN json_each(jt.js) j ORDER BY jt.id',
 'SELECT key,j.value FROM jt JOIN json_each(jsonb(jt.js)) j USING(key) ORDER BY jt.id',
]]
for e in n['encodings']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(r/e['file']).encode(),C.byref(db),1,None)==0
 for q in sqls:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);a={'sql':q,'prepare':rc}
  if rc:
   a['error']=d.sqlite3_errmsg(db).decode()
  else:
   a['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(lambda v: None if v is None else v.decode())(getattr(d,'sqlite3_column_'+name)(st,i)) for name in names])) for i in range(d.sqlite3_column_count(st))];a['runs']=[]
   for _ in range(2):
    rows=[]
    while True:
     rc=d.sqlite3_step(st)
     if rc!=100:break
     rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    a['runs'].append({'rows':rows,'end':rc});d.sqlite3_reset(st)
   d.sqlite3_finalize(st)
  e['cases'].append(a)
 d.sqlite3_close(db)
n['expansionLibrarySha256']=hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest();(r/'expanded.json').write_text(json.dumps(n,indent=2)+'\n')
