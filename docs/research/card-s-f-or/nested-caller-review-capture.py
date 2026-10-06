import ctypes as C, importlib.util,json,pathlib,argparse
parser=argparse.ArgumentParser(description='Supplemental read-only nested OR caller capture; development only')
parser.add_argument('--candidate-root',type=pathlib.Path,required=True)
parser.add_argument('--library',required=True)
parser.add_argument('--output',type=pathlib.Path,required=True)
a=parser.parse_args();exp=a.candidate_root
s=importlib.util.spec_from_file_location('n',exp/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(a.library);manifest=json.loads((exp/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
sql="SELECT x.id,i.id,i.r,i.p FROM o x CROSS JOIN o i WHERE x.id<=2 AND ((i.a IN (x.a,2,NULL) AND i.c IN (4,5,6,NULL)) OR i.b='beta') AND i.rowid<=3"
capture=json.loads((exp/'docs/research/card-s-f-or/native.json').read_text());out={'sourceId':manifest['sqliteSourceId'],'sql':sql,'classification':'supplemental','variants':[]}
for v in capture['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(exp/v['fixture']['path']).encode(),C.byref(db),1,None)==0
 rows,_=n.query(d,db,sql,[]);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[]);assert 'MULTI-INDEX OR' in eqp,eqp
 assert d.sqlite3_close(db)==0
 out['variants'].append({'id':v['id'],'fixture':v['fixture'],'rows':rows,'eqp':eqp})
a.output.write_text(json.dumps(out,indent=2)+'\n');print([(v['id'],len(v['rows'])) for v in out['variants']])
