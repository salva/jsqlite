#!/usr/bin/env python3
"""Pinned native-first vector slot projection receipts (development only)."""
import argparse, ctypes as C, importlib.util, json, pathlib, sys
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'))
o=importlib.util.module_from_spec(s);s.loader.exec_module(o)
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
d=o.load(args.library)
pin=json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
assert d.sqlite3_libversion().decode()==pin['version']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
def metadata(db,sql):
 st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 try:
  result=[]
  for i in range(d.sqlite3_column_count(st)):
   item={}
   for key,native in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    value=getattr(d,'sqlite3_column_'+native)(st,i);item[key]=value.decode() if value else None
   result.append(item)
  return result
 finally:assert d.sqlite3_finalize(st)==0
root=pathlib.Path(args.output);root.mkdir(parents=True,exist_ok=True)
setup='''CREATE TABLE t(id INTEGER PRIMARY KEY,a,b,c);
CREATE INDEX t_ab ON t(a,b,c);
CREATE TABLE projection_t(id INTEGER PRIMARY KEY,a,b,c);
CREATE INDEX projection_a ON projection_t(a);
CREATE INDEX projection_ab ON projection_t(a,b);
INSERT INTO projection_t VALUES(1,1,9,9),(2,2,3,3),(3,9,1,1),(4,3,2,2);
CREATE TABLE projection_rhs(x,y);
INSERT INTO projection_rhs VALUES(1,9),(2,3);
CREATE TABLE rhs(x,y);CREATE UNIQUE INDEX rhs_yx ON rhs(y,x);
INSERT INTO t VALUES(1,1,2,3),(2,1,3,4),(3,2,2,1),(4,NULL,2,9);
INSERT INTO rhs VALUES(1,2),(2,2),(NULL,2);'''
queries=[('complete','SELECT id FROM t INDEXED BY t_ab WHERE (a,b) IN(SELECT x,y FROM rhs) AND c>=2 ORDER BY id'),('partial','SELECT id FROM t INDEXED BY t_ab WHERE (a,c) IN(SELECT x,y FROM rhs) ORDER BY id'),('permuted','SELECT id FROM t INDEXED BY t_ab WHERE (b,a) IN(SELECT x,y FROM rhs) AND c>=1 ORDER BY id')]
queries += [('projected-duplicates','SELECT id FROM t INDEXED BY t_ab WHERE (a,c) IN(SELECT y,x FROM rhs) ORDER BY id'),('repeated-rhs','SELECT id FROM t INDEXED BY t_ab WHERE (b,a) IN(SELECT y,y FROM rhs) ORDER BY id')]
queries += [('unforced','SELECT id FROM t WHERE (b,a) IN(SELECT x,y FROM rhs) AND c>=1 ORDER BY id'),('inner','SELECT l.id FROM t AS l INDEXED BY t_ab JOIN t AS r ON r.id=l.id WHERE (l.b,l.a) IN(SELECT x,y FROM rhs) AND l.c>=1 ORDER BY l.id'),('left','SELECT l.id FROM t AS l INDEXED BY t_ab LEFT JOIN t AS r ON r.id=l.id WHERE (l.b,l.a) IN(SELECT x,y FROM rhs) AND l.c>=1 ORDER BY l.id'),('or','SELECT id FROM t INDEXED BY t_ab WHERE (b,a) IN(SELECT x,y FROM rhs) OR (a,c) IN(SELECT y,x FROM rhs) ORDER BY id')]
# R14: opposing x/y orders make ORDER ownership observable through LIMIT.
# IDs stay INTEGER; native independently supplies rows and all metadata fields.
for label,order in [('ordinal','2'),('alias','chosen')]:
 queries.append(('partial-order-'+label, f'SELECT id FROM projection_t INDEXED BY projection_a WHERE (a,c) IN(SELECT x,y AS chosen FROM projection_rhs ORDER BY {order} LIMIT 1) ORDER BY id'))
for label,order in [('ordinal','1'),('alias','chosen')]:
 queries.append(('permuted-order-'+label, f'SELECT id FROM projection_t INDEXED BY projection_ab WHERE (b,a) IN(SELECT x AS chosen,y FROM projection_rhs ORDER BY {order} LIMIT 1) ORDER BY id'))
queries.append(('partial-group-ordinal','SELECT id FROM projection_t INDEXED BY projection_a WHERE (a,c) IN(SELECT x,y FROM projection_rhs GROUP BY 2 ORDER BY 2 LIMIT 1) ORDER BY id'))
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=root/(enc+'.db');path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 o.execsql(d,db,"PRAGMA encoding='%s'"%enc);o.execsql(d,db,setup);assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 cases=[]
 for name,sql in queries:
  rows,_=o.query(d,db,sql);ops,_=o.query(d,db,'EXPLAIN '+sql);cases.append(dict(name=name,sql=sql,rows=rows,ops=ops,metadata=metadata(db,sql)))
 assert d.sqlite3_close(db)==0
 (root/(enc+'.json')).write_text(json.dumps(dict(sourceid=d.sqlite3_sourceid().decode(),sql=queries[0][1],cases=[c for c in cases if c['name']!='or'],frontierCases=[c for c in cases if c['name']=='or'])))
