#!/usr/bin/env python3
"""Native-first bounded correlated selected/scan work contrast (20k LHS)."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode = True
spec=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'))
o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
d=o.load(args.library)
pin=json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];assert d.sqlite3_libversion().decode()==pin['version']
setup='''CREATE TABLE outer_t(k);CREATE TABLE t(id INTEGER PRIMARY KEY,a,b,c);CREATE INDEX t_ab ON t(a,b,c);CREATE TABLE rhs(k,x,y);
WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20000) INSERT INTO t SELECT x,x,2,3 FROM n;
WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20) INSERT INTO outer_t SELECT x FROM n;
INSERT INTO rhs SELECT k,k,2 FROM outer_t WHERE k<=2;'''
sql='SELECT o.k,t.id FROM outer_t AS o CROSS JOIN t INDEXED BY t_ab WHERE o.k<=2 AND (t.a,t.b) IN(SELECT x,y FROM rhs WHERE rhs.k=o.k) AND t.c>=2 ORDER BY o.k,t.id'
root=pathlib.Path(args.output);root.mkdir(parents=True,exist_ok=True);variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 o.execsql(d,db,"PRAGMA encoding='%s'"%enc);o.execsql(d,db,setup);assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for name,q in [('selected',sql),('scan',sql.replace('INDEXED BY t_ab','NOT INDEXED'))]:
  rows,_=o.query(d,db,q);ops,_=o.query(d,db,'EXPLAIN '+q);assert len(rows)==2
  if name=='selected':assert any(bytes.fromhex(r[1].get('utf8Hex','')).decode()=='SeekGE' for r in ops)
  cases.append(dict(name=name,sql=q,rows=rows,ops=ops))
 assert cases[0]['rows']==cases[1]['rows']
 # wherecode.c covered/noncorrelated/TERM_VARSELECT order is observable.
 correlated='(SELECT abs(-9223372036854775808) FROM rhs WHERE rhs.k=o.k)=1'
 ordering=[]
 for access in ['NOT INDEXED','INDEXED BY t_ab']:
  for condition in [correlated+' AND o.k<0','o.k<0 AND '+correlated]:
   q=f'SELECT o.k,t.id FROM outer_t o CROSS JOIN t {access} WHERE {condition}'
   rows,_=o.query(d,db,q);assert rows==[]
   ops,_=o.query(d,db,'EXPLAIN '+q)
   ordering.append(dict(sql=q,rows=rows,ops=ops))
 # Check the positive/error control directly so the oracle helper does not
 # leak a statement when sqlite3_step fails. Reset returns the previous error.
 q=f'SELECT o.k,t.id FROM outer_t o CROSS JOIN t NOT INDEXED WHERE {correlated} AND o.k<=2'
 st=C.c_void_p();assert d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None)==0
 for run in range(2):
  assert d.sqlite3_step(st)==1
  assert d.sqlite3_reset(st)==1
 assert d.sqlite3_finalize(st)==0
 assert d.sqlite3_close(db)==0
 variants.append(dict(encoding=enc,fixture=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),cases=cases,ordering=ordering))
(root/'native.json').write_text(json.dumps(dict(sourceid=pin['sqliteSourceId'],version=pin['version'],variants=variants)))
