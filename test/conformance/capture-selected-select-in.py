#!/usr/bin/env python3
"""Native-FIRST scalar SELECT-IN LOOP evidence; output/fixtures are explicit paths."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture_index',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
lib,outdir=sys.argv[1:];out=pathlib.Path(outdir);out.mkdir(parents=True,exist_ok=True)
d=m.load(lib);manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
assert d.sqlite3_libversion().decode()==manifest['version']
d.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];d.sqlite3_column_name.restype=C.c_char_p
for api in ['decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+api);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_bind_parameter_count.argtypes=[C.c_void_p]
d.sqlite3_bind_parameter_name.argtypes=[C.c_void_p,C.c_int];d.sqlite3_bind_parameter_name.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p

def metadata(st):
 def value(api,i):
  v=getattr(d,'sqlite3_column_'+api)(st,i)
  return v.decode() if v else None
 return [{api:value(api,i) for api in ['name','decltype','database_name','table_name','origin_name']} for i in range(d.sqlite3_column_count(st))]

def repeated(db,sql,runs):
 st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc==0
 try:
  slots=[d.sqlite3_bind_parameter_name(st,i).decode() if d.sqlite3_bind_parameter_name(st,i) else None for i in range(1,d.sqlite3_bind_parameter_count(st)+1)]
  result=[]
  for params in runs:
   assert d.sqlite3_reset(st)==0
   assert d.sqlite3_clear_bindings(st)==0
   m.bind(d,st,params);rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==m.ROW:rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))]);continue
    assert rc==m.DONE,rc
    break
   result.append({'bindings':params,'rows':rows})
  return {'sql':sql,'slots':slots,'metadata':metadata(st),'runs':result}
 finally:d.sqlite3_finalize(st)

def program(db,sql,params):
 rows,_=m.query(d,db,'EXPLAIN '+sql,params)
 return [{'addr':int(r[0]['value']),'opcode':m.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value']),'p4':None if r[5]['type']=='null' else m.text(r[5]),'p5':int(r[6]['value'])} for r in rows]

cases={
 'affinity-forced':("SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT CAST(v AS TEXT) FROM rhs)",[]),
 'affinity-joined':("SELECT x.id,y.id FROM t x INDEXED BY t_ab JOIN t y ON y.id=x.id WHERE x.a IN(SELECT CAST(v AS TEXT) FROM rhs)",[]),
 'affinity-joined-or':("SELECT x.id,y.id FROM t x JOIN t y ON y.id=x.id WHERE x.a IN(SELECT CAST(v AS TEXT) FROM rhs) OR x.b=3",[]),
 'left-null-prefix':("SELECT x.v,y.id FROM rhs x LEFT JOIN t y INDEXED BY t_ab ON y.a=?1 AND y.b IN(SELECT v FROM rhs)",[None]),
 'null-prefix':("SELECT id FROM t INDEXED BY t_ab WHERE a=?1 AND b IN(SELECT v FROM rhs)",[None]),
 'join':("SELECT x.id,y.id FROM t x JOIN t y ON y.id=x.id WHERE x.a IN(SELECT v FROM rhs) ORDER BY x.id",[]),
 'left':("SELECT x.v,y.id FROM rhs x LEFT JOIN t y INDEXED BY t_ab ON y.a=x.v AND y.b IN(SELECT v FROM rhs) ORDER BY x.v,y.id",[]),
 'two-slot':("SELECT id,a,b FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs) AND b IN(SELECT v FROM rhs) ORDER BY id",[]),
 'or':("SELECT id FROM t WHERE (a IN(SELECT v FROM rhs) AND b>1) OR (a=3 AND b=3) ORDER BY id",[]),
 'useful':("SELECT id,a,b FROM t WHERE a IN(SELECT v FROM rhs) ORDER BY id",[]),
 'forced':("SELECT id,a,b FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs) ORDER BY id",[]),
 'scan':("SELECT id,a,b FROM t NOT INDEXED WHERE a IN(SELECT v FROM rhs) ORDER BY id",[]),
 'empty':("SELECT id FROM t WHERE a IN(SELECT v FROM rhs WHERE 0) ORDER BY id",[]),
 'null':("SELECT id FROM t WHERE a IN(SELECT NULL FROM rhs) ORDER BY id",[]),
 'range':("SELECT id,a,b FROM t WHERE a IN(SELECT v FROM rhs) AND b>1 AND b<=3 ORDER BY a,b,id",[]),
 'range-desc':("SELECT id,a,b FROM t WHERE a IN(SELECT v FROM rhs) AND b>=1 AND b<3 ORDER BY a DESC,b DESC,id DESC",[]),
 'ipk':("SELECT id FROM t WHERE id IN(SELECT v FROM rhs) ORDER BY id",[]),
 'limit':("SELECT id FROM t WHERE a IN(SELECT v FROM rhs) ORDER BY a,b LIMIT 1",[]),
 'param-one':("SELECT ?2,id FROM t WHERE a IN(SELECT v FROM rhs WHERE v=?1) ORDER BY id",[1,'slot-two']),
 'param-two':("SELECT ?2,id FROM t WHERE a IN(SELECT v FROM rhs WHERE v=?1) ORDER BY id",[2,'rebound']),
 'membership':("SELECT 1 IN(SELECT v FROM rhs),4 IN(SELECT v FROM rhs),4 NOT IN(SELECT v FROM rhs),NULL IN(SELECT v FROM rhs),NULL IN(SELECT v FROM rhs WHERE 0)",[]),
 'affinity':("SELECT id FROM t WHERE a IN(SELECT CAST(v AS TEXT) FROM rhs) ORDER BY id",[]),
 'nocase':("SELECT v FROM rhs WHERE v COLLATE NOCASE IN(SELECT 'A') ORDER BY v",[]),
 'rtrim':("SELECT v FROM rhs WHERE v COLLATE RTRIM IN(SELECT 'A') ORDER BY v",[]),
}
variants=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(encoding+'.db');path.unlink(missing_ok=True);db=C.c_void_p()
 assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 try:
  for sql in [f"PRAGMA encoding='{encoding}'",'CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b REAL)','CREATE INDEX t_ab ON t(a,b)','CREATE INDEX t_b ON t(b DESC,a DESC)','CREATE TABLE rhs(v)',"INSERT INTO rhs VALUES(1),(1),(1.0),(2),(NULL),('2'),('A'),('a'),('A '),(x'32')",'BEGIN'] :m.execsql(d,db,sql)
  for i in range(1,2001):m.execsql(d,db,f'INSERT INTO t VALUES({i},{i%200},{i%4}.0)')
  m.execsql(d,db,'COMMIT');m.execsql(d,db,'ANALYZE')
 finally:d.sqlite3_close(db)
 assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==0
 captured={}
 try:
  for name,(sql,params) in cases.items():
   rows,work=m.query(d,db,sql,params);st=C.c_void_p()
   rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc==0
   names=[d.sqlite3_column_name(st,i).decode() for i in range(d.sqlite3_column_count(st))];meta=metadata(st);d.sqlite3_finalize(st)
   captured[name]={'sql':sql,'bindings':params,'rows':rows,'columnNames':names,'metadata':meta,'work':work,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,params),'program':program(db,sql,params)}
  reset=repeated(db,cases['param-one'][0],[[1,'slot-two'],[2,'rebound'],[None,'null'],[1,'retry']])
  errors=[]
  for sql in ['SELECT id FROM t WHERE a IN(SELECT v,v FROM rhs)','SELECT id FROM t WHERE a IN(SELECT missing FROM rhs)']:
   st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
   errors.append({'sql':sql,'prepareCode':rc,'message':d.sqlite3_errmsg(db).decode()})
   if st:d.sqlite3_finalize(st)
 finally:d.sqlite3_close(db)
 variants.append({'encoding':encoding,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'cases':captured,'sameStatementReset':reset,'errors':errors})
result={'sourceId':manifest['sqliteSourceId'],'variants':variants}
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
print('captured',len(cases),'cases x',len(variants),'encodings')
print('capture SHA256',hashlib.sha256((out/'native.json').read_bytes()).hexdigest())
for v in variants:print(v['encoding'],v['cases']['useful']['eqp'])
