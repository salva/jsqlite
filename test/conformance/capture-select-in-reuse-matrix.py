#!/usr/bin/env python3
"""Pinned typed/affinity/physical-direction scalar LOOP coverage, read-only oracle."""
import argparse, ctypes as C, hashlib, json, pathlib, sys
sys.dont_write_bytecode=True
from importlib.util import spec_from_file_location, module_from_spec
s=spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'))
o=module_from_spec(s); s.loader.exec_module(o)
a=argparse.ArgumentParser(); a.add_argument('--library',required=True); a.add_argument('--output',required=True); args=a.parse_args()
d=o.load(args.library)
manifest=json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
assert d.sqlite3_libversion().decode()==manifest['version']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name); f.argtypes=[C.c_void_p,C.c_int]; f.restype=C.c_char_p

def metadata(db,sql):
 st=C.c_void_p(); assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 try:
  result=[]
  for i in range(d.sqlite3_column_count(st)):
   item={}
   for key,native in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    value=getattr(d,'sqlite3_column_'+native)(st,i); item[key]=value.decode() if value else None
   result.append(item)
  return result
 finally: assert d.sqlite3_finalize(st)==0

setup='''CREATE TABLE typed(id INTEGER PRIMARY KEY,v,b INTEGER);
CREATE INDEX typed_vb ON typed(v,b);CREATE INDEX typed_b ON typed(b);
CREATE TABLE mixed(v UNIQUE);CREATE TABLE mixed_desc(v);CREATE UNIQUE INDEX mixed_desc_v ON mixed_desc(v DESC);
INSERT INTO mixed VALUES(NULL),(1),(1.5),('é'),(X'00FF');INSERT INTO mixed_desc SELECT v FROM mixed;
INSERT INTO typed VALUES(1,1,1),(2,1.5,2),(3,'é',3),(4,X'00FF',4),(5,NULL,5),(6,9,6);
CREATE TABLE words(id INTEGER PRIMARY KEY,v TEXT COLLATE NOCASE);CREATE INDEX words_v ON words(v);
INSERT INTO words VALUES(1,'a'),(2,'A'),(3,'é'),(4,NULL);
CREATE TABLE word_rhs(v TEXT COLLATE NOCASE UNIQUE);INSERT INTO word_rhs VALUES('a'),('é'),(NULL);
CREATE TABLE binary_rhs(v TEXT UNIQUE);INSERT INTO binary_rhs VALUES('a'),('é'),(NULL);
CREATE TABLE trim_lhs(id INTEGER PRIMARY KEY,v TEXT COLLATE RTRIM);CREATE INDEX trim_v ON trim_lhs(v);
CREATE TABLE trim_rhs(v TEXT COLLATE RTRIM UNIQUE);INSERT INTO trim_rhs VALUES('x'),(NULL);
INSERT INTO trim_lhs VALUES(1,'x'),(2,'x '),(3,NULL);
CREATE TABLE numbers(id INTEGER PRIMARY KEY,v NUMERIC);CREATE INDEX numbers_v ON numbers(v);
CREATE TABLE text_rhs(v TEXT UNIQUE);INSERT INTO text_rhs VALUES('1'),('1.5'),(NULL);
INSERT INTO numbers VALUES(1,1),(2,1.5),(3,3);
CREATE TABLE empty_rhs(v UNIQUE);
CREATE TABLE big(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,payload TEXT);
CREATE INDEX big_ab ON big(a,b);CREATE INDEX big_b ON big(b);
WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<20000)
INSERT INTO big SELECT x,x%1000,x%20,'payload' FROM n;
CREATE TABLE big_rhs(v INTEGER);CREATE UNIQUE INDEX big_rhs_v ON big_rhs(v DESC);
INSERT INTO big_rhs VALUES(2),(503),(NULL);'''
cases=[
 ('or-reuse','SELECT id,v,b FROM typed WHERE v IN(SELECT v FROM mixed_desc) OR b=6',True),
 ('mixed-asc','SELECT id,v,b FROM typed INDEXED BY typed_vb WHERE v IN(SELECT v FROM mixed) AND b>=1 AND b<5',True),
 ('mixed-desc','SELECT id,v,b FROM typed INDEXED BY typed_vb WHERE v IN(SELECT v FROM mixed_desc) AND b>0 AND b<=4',True),
 ('nocase','SELECT id,v FROM words INDEXED BY words_v WHERE v IN(SELECT v FROM word_rhs)',True),
 ('collation-mismatch','SELECT id,v FROM words INDEXED BY words_v WHERE v IN(SELECT v FROM binary_rhs)',False),
 ('rtrim','SELECT id,v FROM trim_lhs INDEXED BY trim_v WHERE v IN(SELECT v FROM trim_rhs)',True),
 ('affinity-mismatch','SELECT id,v FROM numbers INDEXED BY numbers_v WHERE v IN(SELECT v FROM text_rhs)',False),
 ('empty','SELECT id,v,b FROM typed INDEXED BY typed_vb WHERE v IN(SELECT v FROM empty_rhs)',True),
 ('limited','SELECT id,v,b FROM typed INDEXED BY typed_vb WHERE v IN(SELECT v FROM mixed_desc) LIMIT 2',True),
 ('parameter-residual','SELECT id,v,b FROM typed INDEXED BY typed_vb WHERE v IN(SELECT v FROM mixed_desc) AND b>=?1 AND b<?2',True),
 ('inner','SELECT t.id,t.v FROM typed AS t INDEXED BY typed_vb JOIN numbers AS n ON n.id=t.id WHERE t.v IN(SELECT v FROM mixed_desc)',True),
 ('left','SELECT n.id,t.id,t.v FROM numbers AS n LEFT JOIN typed AS t INDEXED BY typed_vb ON t.b=n.id AND t.v IN(SELECT v FROM mixed_desc)',True),
 ('inner-residual','SELECT t.id,t.v FROM typed AS t INDEXED BY typed_vb JOIN numbers AS n ON n.id=t.id WHERE t.v IN(SELECT v FROM mixed_desc) AND t.id=2',True),
 ('left-residual','SELECT n.id,t.id,t.v FROM numbers AS n LEFT JOIN typed AS t INDEXED BY typed_vb ON t.b=n.id AND t.v IN(SELECT v FROM mixed_desc) AND t.id<2',True),
 ('useful-range','SELECT id,a,b,payload FROM big INDEXED BY big_ab WHERE a IN(SELECT v FROM big_rhs) AND b>=2 AND b<4',True),
 ('useful-scan','SELECT id,a,b,payload FROM big NOT INDEXED WHERE a IN(SELECT v FROM big_rhs) AND b>=2 AND b<4',True),
]
out=pathlib.Path(args.output); out.mkdir(parents=True,exist_ok=True); variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(enc+'.db'); path.unlink(missing_ok=True)
 db=C.c_void_p(); assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 o.execsql(d,db,f"PRAGMA encoding='{enc}';"+setup)
 assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 captured=[]
 try:
  for name,sql,reuse in cases:
   bindings=[1,5] if name=='parameter-residual' else []
   rows,work=o.query(d,db,sql,bindings); program,_=o.query(d,db,'EXPLAIN '+sql,bindings)
   ops=[dict(opcode=o.text(r[1]),p1=int(r[2]['value']),p2=int(r[3]['value']),p3=int(r[4]['value'])) for r in program]
   # Membership on NOT INDEXED is not IN_INDEX_LOOP. Retain its native full
   # program but do not use that branch as a LOOP structural discriminator.
   if name!='useful-scan': assert ('OpenEphemeral' not in [op['opcode'] for op in ops])==reuse,(name,ops)
   captured.append(dict(name=name,sql=sql,rows=rows,metadata=metadata(db,sql),work=work,ops=ops,reuse=reuse,bindings=bindings,
    bindingRuns=[dict(bindings=values,rows=o.query(d,db,sql,values)[0]) for values in [[1,5],[None,None],[3,5]]] if bindings else []))
 finally: assert d.sqlite3_close(db)==0
 variants.append(dict(encoding=enc,fixture=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),cases=captured))
(out/'native.json').write_text(json.dumps(dict(sourceid=d.sqlite3_sourceid().decode(),version=d.sqlite3_libversion().decode(),variants=variants),indent=2)+'\n')
print('captured',len(cases),'cases x',len(variants),'encodings')
