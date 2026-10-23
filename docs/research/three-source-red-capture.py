"""Fresh pinned three-source matched-access rows, metadata and access evidence."""
import ctypes as C, importlib.util, pathlib, json, hashlib, sys, shutil, base64
r=pathlib.Path(sys.argv[1]); w=pathlib.Path(sys.argv[2]);lib=w/'native-build/libsqlite3-red.so'
s=importlib.util.spec_from_file_location('oracle',r/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
d=m.load(str(lib));source=d.sqlite3_sourceid().decode();assert source==json.loads((r/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
result={'sourceId':source,'librarySha256':hashlib.sha256(lib.read_bytes()).hexdigest(),'cases':[]}
for field in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+field);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
base='SELECT l.id,r.id,z.id FROM m l NOT INDEXED RIGHT JOIN m r ON r.a=l.a AND r.b=1 CROSS JOIN m z NOT INDEXED WHERE z.id=1'
queries=[('right',base),('cross','SELECT l.id,r.id,z.id FROM m l NOT INDEXED CROSS JOIN m r CROSS JOIN m z NOT INDEXED WHERE r.a=l.a AND r.b=1 AND z.id=1')]
for join in ['RIGHT','FULL']:
 for access,hint in [('unforced',''),('forced',' INDEXED BY m_abc'),('scan',' NOT INDEXED')]:
  queries.append((join.lower()+'-'+access,base.replace('RIGHT JOIN m r ON',join+' JOIN m r'+hint+' ON')))
queries += [
 ('right-last','SELECT l.id,r.id,z.id FROM m l NOT INDEXED LEFT JOIN m r ON r.id=l.id RIGHT JOIN m z ON z.a=r.a AND z.b=1'),
 ('left-after','SELECT l.id,r.id,z.id FROM m l NOT INDEXED RIGHT JOIN m r ON r.a=l.a AND r.b=1 LEFT JOIN m z ON z.id=r.id'),
 ('where-after',base+' AND r.id>1'),
 ('on-filter',base.replace('r.b=1','r.b=1 AND r.id>1')),
 ('no-on-match',base.replace('r.a=l.a','r.a=l.a AND l.id=-1')),
 ('empty-left','SELECT l.id,r.id,z.id FROM m l NOT INDEXED RIGHT JOIN m r ON r.a=l.a AND r.b=1 CROSS JOIN m z NOT INDEXED WHERE l.id=-1 AND z.id=1'),
 ('expression','SELECT l.id,r.id,z.id FROM e l NOT INDEXED RIGHT JOIN e r ON lower(r.a)=lower(l.a) AND r.b+1=2 CROSS JOIN m z NOT INDEXED WHERE z.id=1'),
 ('partial','SELECT l.id,r.id,z.id FROM p l NOT INDEXED RIGHT JOIN p r ON r.a=l.a AND r.c IS NOT NULL CROSS JOIN m z NOT INDEXED WHERE z.id=1'),
 ('partial-unproven','SELECT l.id,r.id,z.id FROM p l NOT INDEXED RIGHT JOIN p r ON r.a=l.a CROSS JOIN m z NOT INDEXED WHERE z.id=1 AND r.c IS NOT NULL'),
 ('wrong-alias','SELECT l.id,r.id,z.id FROM e l NOT INDEXED RIGHT JOIN e r ON lower(l.a)=lower(l.a) AND r.b=1 CROSS JOIN m z NOT INDEXED WHERE z.id=1'),
 ('correlated',base.replace('r.b=1','r.b=(SELECT l.b)')),
]
for enc in ['utf8','utf16le','utf16be']:
 p=r/f'test/conformance/fixtures/advanced-index-{enc}.db';db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 for name,sql in queries+[('physical-empty','SELECT l.id,r.id,z.id FROM empty_m l NOT INDEXED RIGHT JOIN m r ON r.a=l.a AND r.b=1 CROSS JOIN m z NOT INDEXED WHERE z.id=1')]:
  fixture=p
  if name=='physical-empty':
   fixture=w/f'empty-{enc}.db';shutil.copyfile(p,fixture)
   edb=C.c_void_p();assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(edb),2,None)==0
   m.execsql(d,edb,'CREATE TABLE empty_m(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER)')
   d.sqlite3_close(edb);d.sqlite3_close(db);assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0;runs=[]
  for _ in range(2):
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([m.cell(d,st,i) for i in range(3)])
   reset=d.sqlite3_reset(st);assert rc==101 and reset==0;runs.append(rows)
  columns=[{key:(getattr(d,'sqlite3_column_'+field)(st,i) or b'').decode() or None for key,field in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]} for i in range(3)]
  assert runs[0]==runs[1];d.sqlite3_finalize(st)
  result['cases'].append({'encoding':enc,'name':name,'sql':sql,'rows':runs[0],'columns':columns,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[]),'fixtureSha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),**({'fixtureBase64':base64.b64encode(fixture.read_bytes()).decode()} if name=='physical-empty' else {})})
 d.sqlite3_close(db)
(w/'native.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
