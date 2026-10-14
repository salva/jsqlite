import ctypes as C,json,pathlib,importlib.util,hashlib,os
s=importlib.util.spec_from_file_location('capture','test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
import sys
d=m.load(sys.argv[1]);manifest=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
corpus=json.load(open('test/conformance/cases/repeated-right-full.json'));cases=json.load(open('test/conformance/cases/right-nested.json'));out=[]
original=[a for a in cases['cases'] if a['id']=='in-left']
base='SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k'
queries=[('original',original[0]['sql']),('not-in',base+' WHERE 3 NOT IN(SELECT z.k) ORDER BY 1,2,3'),('null',base+' WHERE NULL IN(SELECT z.k) ORDER BY 1,2,3'),('empty',base+' WHERE NULL IN(SELECT z.k WHERE 0) ORDER BY 1,2,3'),('empty-not',base+' WHERE NULL NOT IN(SELECT z.k WHERE 0) ORDER BY 1,2,3'),('correlated-empty',base+' WHERE 3 IN(SELECT z.k WHERE b.k=3) ORDER BY 1,2,3'),('on-ready','SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k IN(SELECT b.k) ORDER BY 1,2,3')]
expanded=[dict(a,id=name,sql=q) for a in original for name,q in queries]
for a in expanded:
 fixture=corpus['fixtures'][a['encoding']];p=pathlib.Path('test/conformance/fixtures')/fixture['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==fixture['sha256'];db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 st=C.c_void_p();assert d.sqlite3_prepare_v2(db,a['sql'].encode(),-1,C.byref(st),None)==0
 cols=[dict(zip(['name','declType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(d.sqlite3_column_count(st))];runs=[]
 for _ in range(2):
  rows=[]
  while True:
   rc=d.sqlite3_step(st)
   if rc!=100:break
   rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
  assert rc==101;assert d.sqlite3_reset(st)==0;runs.append({'rows':rows,'done':rc})
 d.sqlite3_finalize(st);d.sqlite3_close(db);out.append({'id':a['id'],'encoding':a['encoding'],'fixture':fixture,'sql':a['sql'],'columns':cols,'runs':runs})
p=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'right-nested-in-native.json';p.write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'cases':out},indent=2));print('pinned native 7 SQL x3 encodings captured full metadata/typed rows/DONE/two resets');print(p,hashlib.sha256(p.read_bytes()).hexdigest())
