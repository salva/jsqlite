import argparse,ctypes as C,importlib.util,json,pathlib,hashlib
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args();root=pathlib.Path.cwd()
s=importlib.util.spec_from_file_location('n',root/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n);d=n.load(a.library);m=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==m['sqliteSourceId']
cases=[{'id':'volatile','sql':"SELECT i.id FROM o i WHERE i.a=(random() IS NULL) OR i.b='beta'"}, {'id':'unready','sql':"SELECT i.id,x.id FROM o i CROSS JOIN o x WHERE (i.a=abs(?1) AND x.a=i.a) OR (i.b='beta' AND x.b=i.b)"}, {'id': 'direct', 'sql': "SELECT i.id FROM o i WHERE i.a=abs(?1) OR i.b='beta'"}, {'id': 'and', 'sql': "SELECT i.id FROM o i WHERE (i.a=abs(?1) AND i.rowid<=3) OR (i.b='beta' AND i.rowid<=3)"}, {'id': 'nested', 'sql': "SELECT i.id FROM o i WHERE (i.a=abs(?1) OR i.b='beta') OR i.a=2"}, {'id': 'joined', 'sql': "SELECT x.id,i.id FROM o x CROSS JOIN o i WHERE x.id<=2 AND (i.a=abs(?1) OR i.b='beta')"}];out={'sourceId':m['sqliteSourceId'],'classification':'supplemental','variants':[]}
for v in json.load(open('docs/research/card-s-f-or/native.json'))['variants']:
 path=root/v['fixture']['path'];assert hashlib.sha256(path.read_bytes()).hexdigest()==v['fixture']['sha256'];db=C.c_void_p();assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0;r=[]
 for case in cases:
  eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',case['sql'],[]);assert 'MULTI-INDEX OR' in eqp
  program,_=n.query(d,db,'EXPLAIN '+case['sql'],[]);st=C.c_void_p();assert d.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(st),None)==0;runs=[]
  for value in [1,-9223372036854775808,2,None]:
   
   if case['id']!='volatile':n.bind(d,st,[value])
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   d.sqlite3_errmsg.restype=C.c_char_p;d.sqlite3_errmsg.argtypes=[C.c_void_p];msg=d.sqlite3_errmsg(db).decode();reset=d.sqlite3_reset(st);runs.append({'binding':value,'rows':rows,'code':0 if rc==101 else rc,'message':None if rc==101 else msg,'resetCode':reset})
  d.sqlite3_finalize(st);r.append({**case,'eqp':eqp,'program':program,'runs':runs})
 assert d.sqlite3_close(db)==0;out['variants'].append({'id':v['id'],'fixture':v['fixture'],'cases':r})
a.output.write_text(json.dumps(out,indent=2)+'\n');print([(v['id'],[(c['id'],len(c['program'])) for c in v['cases']]) for v in out['variants']])
