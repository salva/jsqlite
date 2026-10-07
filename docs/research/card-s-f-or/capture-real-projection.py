"""Development-only read-only pinned oracle; no fixture writes."""
import argparse,ctypes as C,hashlib,importlib.util,json,pathlib
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path.cwd();spec=importlib.util.spec_from_file_location('n',root/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);d=n.load(a.library);P=C.c_void_p
assert d.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for f in ['name','decltype','database_name','table_name','origin_name']:
 fn=getattr(d,'sqlite3_column_'+f);fn.argtypes=[P,C.c_int];fn.restype=C.c_char_p
cases=[
 ('single-covering',"SELECT rowid,c FROM t INDEXED BY tc WHERE c>=?1 ORDER BY c"),
 ('ordinary',"SELECT x.id,y.id,y.c,y.tag FROM t x CROSS JOIN t y NOT INDEXED WHERE x.id=1 AND y.id>=?1 ORDER BY y.id"),
 ('index-or-covering',"SELECT x.id,y.rowid,y.c FROM t x CROSS JOIN t y INDEXED BY tc WHERE x.id=1 AND ((y.c>=?1 AND y.c<2) OR (y.c>=2.5 AND y.c<3)) ORDER BY y.rowid"),
 ('ordinary-covering',"SELECT x.id,y.rowid,y.c FROM t x CROSS JOIN t y INDEXED BY tc WHERE x.id=1 AND y.c>=?1 ORDER BY y.rowid"),
 ('coalesced',"SELECT c,x.rowid,y.rowid FROM t x FULL JOIN t y USING(c) WHERE x.rowid<=?1 OR y.rowid<=?1 ORDER BY x.rowid,y.rowid"),
]
out={'sourceId':d.sqlite3_sourceid().decode(),'classification':'supplemental','variants':[]}
for enc in ['utf-8','utf-16le','utf-16be']:
 path=root/f'test/conformance/fixtures/row-width-real-metadata-{enc}.db';db=P();assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 v={'encoding':enc,'fixture':{'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'cases':[]}
 for id,sql in cases:
  st=P();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  meta=[]
  for i in range(d.sqlite3_column_count(st)):
   m={}
   for k,f in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    raw=getattr(d,'sqlite3_column_'+f)(st,i);m[k]=raw.decode() if raw else None
   meta.append(m)
  runs=[]
  for tag,value in [('integer',1),('real',1.0),('integer',2),('null',None)]:
   assert d.sqlite3_reset(st)==0;assert d.sqlite3_clear_bindings(st)==0;n.bind(d,st,[value]);rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==100:rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
    else:break
   assert rc==101,rc;runs.append({'binding':{'type':tag,'value':value},'rows':rows,'resultCode':rc})
  assert d.sqlite3_finalize(st)==0
  eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[1]);ops=n.explain(d,db,'EXPLAIN ',sql,[1]);v['cases'].append({'id':id,'sql':sql,'metadata':meta,'eqp':eqp,'ops':ops,'runs':runs})
 assert d.sqlite3_close(db)==0;out['variants'].append(v)
out['legacyControls']=[]
advanced=json.loads((root/'test/conformance/cases/stage3-advanced-index.json').read_text())
controls=[('left', 'test/conformance/fixtures/multisource-inner-oracle.db','SELECT * FROM l AS left_side LEFT JOIN r AS right_side USING(k) ORDER BY left_side.id',[])]
for v in advanced['variants']:
 for label,sql in [('forward','SELECT p.id,p.c FROM p NOT INDEXED JOIN m ON p.a=m.c WHERE m.id=?1 ORDER BY p.id'),('reversed','SELECT p.id,p.c FROM m JOIN p NOT INDEXED ON p.a=m.c WHERE m.id=?1 ORDER BY p.id'),('left','SELECT p.id,p.c FROM m LEFT JOIN p NOT INDEXED ON p.a=m.c WHERE m.id=?1 ORDER BY p.id')]:
  controls.append((v['id']+'/'+label,v['fixture']['path'],sql,[1]))
for id,path,sql,bindings in controls:
 db=P();assert d.sqlite3_open_v2(str(root/path).encode(),C.byref(db),1,None)==0
 rows,_=n.query(d,db,sql,bindings);out['legacyControls'].append({'id':id,'fixture':path,'sql':sql,'rows':rows});assert d.sqlite3_close(db)==0
pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n');print('native',len(out['variants'])*len(cases)*4,'steps')
