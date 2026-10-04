#!/usr/bin/env python3
"""Development-only R2 controls; frozen databases always opened read-only.
Native capture precedes consuming public acceptance tests. No runtime native use.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('stat',ROOT/'test/conformance/capture-in-range-stat.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
m=s.m
SELECT="SELECT t.id AS ident,t.a,t.b,t.c AS real_value,t.tag AS label,?3 AS bytes,?4 AS mixed FROM t{hint} WHERE t.a=?1 AND t.b IN (13,14) ORDER BY t.id"
SQL={name:SELECT.format(hint=hint) for name,hint in [('choice',''),('force-a',' INDEXED BY t_a'),('force-ab',' INDEXED BY t_ab')]}
SQL['dependency']="SELECT t.id AS ident,t.c AS real_value,t.tag AS label,u.id AS matched,u.c AS rhs_real,?3 AS bytes,?4 AS mixed FROM t JOIN t AS u INDEXED BY t_ab ON u.a=t.a AND u.b=?2 WHERE t.a=?1 AND t.b IN (13,14) ORDER BY t.id,u.id"
SQL['left']="SELECT t.id AS ident,t.c AS real_value,t.tag AS label,u.id AS matched,u.c AS rhs_real,?3 AS bytes,?4 AS mixed FROM t LEFT JOIN t AS u INDEXED BY t_ab ON u.a=t.a AND u.b=?2 AND u.id=t.id WHERE t.a=?1 AND t.b IN (13,14) ORDER BY t.id,u.id"
PARAMS=[[1,13,{'type':'blob','hex':'00ff804100'},'雪\u0000é'],[2,14,{'type':'blob','hex':'ff00'},2.5],[None,13,{'type':'blob','hex':''},None]]
def setup(d):
 for name in ['name','decltype','database_name','table_name','origin_name']:
  f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
 d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
 d.sqlite3_extended_errcode.argtypes=[C.c_void_p]
def prepare(d,db,sql):
 st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
 if rc:raise RuntimeError((rc,d.sqlite3_errmsg(db)))
 return st
def metadata(d,st):
 return [{k:(v.decode() if v is not None else None) for k,n in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')] for v in [getattr(d,'sqlite3_column_'+n)(st,i)]} for i in range(d.sqlite3_column_count(st))]
def rows(d,st):
 out=[]
 while True:
  rc=d.sqlite3_step(st)
  if rc==m.ROW:out.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
  elif rc==m.DONE:return out
  else:raise RuntimeError(rc)
def capture(d):
 s.identity(d);setup(d);variants=[]
 for encoding in ['utf8','utf16le','utf16be']:
  for state in ['before','after']:
   f=ROOT/f'test/conformance/fixtures/in-range-stat-{encoding}-{state}.db';db=s.open_db(d,f,True)
   try:
    cases={}
    for name,sql in SQL.items():
     st=prepare(d,db,sql)
     try:
      meta=metadata(d,st);runs=[]
      for params in PARAMS:
       m.bind(d,st,params);first=rows(d,st);rc=d.sqlite3_reset(st);assert rc==0
       repeated=rows(d,st);assert first==repeated;assert d.sqlite3_reset(st)==0
       runs.append({'parameters':params,'rows':first,'resetRows':repeated,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,params),'vdbe':s.full_vdbe(d,db,sql,params)})
      assert d.sqlite3_clear_bindings(st)==0
      cleared=rows(d,st);assert d.sqlite3_reset(st)==0
      bindrc=d.sqlite3_bind_null(st,5);assert bindrc==25
      cases[name]={'metadata':meta,'runs':runs,'clearRows':cleared,'outOfRangeBind':bindrc}
     finally:d.sqlite3_finalize(st)
    st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,b'SELECT id FROM t INDEXED BY missing_index WHERE a=?1',-1,C.byref(st),None)
    assert rc==1
    error={'code':rc,'extendedCode':d.sqlite3_extended_errcode(db),'message':d.sqlite3_errmsg(db).decode()}
    if st:d.sqlite3_finalize(st)
    roots={m.text(r[0]):int(r[1]['value']) for r in m.query(d,db,"SELECT name,rootpage FROM sqlite_schema WHERE type IN ('table','index')")[0]}
    variants.append({'encoding':encoding,'state':state,'fixture':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'roots':roots,'cases':cases,'prepareError':error})
   finally:d.sqlite3_close(db)
 return {'schema':'jsqlite-candidate-lifecycle-native/1','sourceId':s.SOURCE['sqliteSourceId'],'sql':SQL,'variants':variants}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
 result=capture(m.load(args.library));pathlib.Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('native source verified; six snapshots, five routes, three rebindings and retained reset per route')
