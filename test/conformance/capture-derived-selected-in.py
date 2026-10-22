#!/usr/bin/env python3
"""Derived outer-source readiness: native-first extension of attributed g52 fixture."""
import argparse, ctypes as C, importlib.util, json, pathlib, runpy, sys
sys.dont_write_bytecode=True
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);p.add_argument('--nested',action='store_true',help='correlated nested UNION ALL dependency');p.add_argument('--distinct',action='store_true',help='retain a DISTINCT outer producer instead of flattening');p.add_argument('--retained-limit',action='store_true',help='retain ORDER BY k LIMIT 4 before the parent join');p.add_argument('--grouped',action='store_true',help='retain GROUP, HAVING and aggregate children through the joined destination');a=p.parse_args()
# g52 owns fixture construction. Keep its products intact in a child directory.
root=pathlib.Path(a.output);root.mkdir(parents=True,exist_ok=True)
sys.argv=[sys.argv[0],'--library',a.library,'--output',str(root/'base')]
runpy.run_path(str(pathlib.Path(__file__).with_name('capture-selected-in-r1-matrix.py')),run_name='__main__')
s=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'));o=importlib.util.module_from_spec(s);s.loader.exec_module(o);d=o.load(a.library)
r=json.loads((root/'base/native.json').read_text())
for v in r['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(root/'base'/v['fixture']).encode(),C.byref(db),1,None)==0
 for name in ('name','decltype','database_name','table_name','origin_name'):
  f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
 def metadata(sql):
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  try:return [{key:(value.decode() if value else None) for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')] for value in [getattr(d,'sqlite3_column_'+fn)(st,i)]} for i in range(d.sqlite3_column_count(st))]
  finally:d.sqlite3_finalize(st)
 cases=[]
 for c in v['cases']:
  if c['name'] not in (['correlated','left-on','left-where','or','rebind'] if a.retained_limit or a.grouped else ['correlated','left-on','left-where','or']):continue
  producer='(SELECT k FROM outer_t GROUP BY k) AS o' if a.grouped else '(SELECT k FROM outer_t ORDER BY k LIMIT 4) AS o' if a.retained_limit else '(SELECT DISTINCT k FROM outer_t) AS o' if a.distinct else '(SELECT k FROM outer_t) AS o'
  q=c['sql'].replace('outer_t AS o',producer)
  if a.nested:q=q.replace('rhs.k=o.k','rhs.k IN(SELECT o.k UNION ALL SELECT o.k)')
  if c['name']=='rebind':
   runs=[]
   for run in c['runs']:
    value=run['bindings'][0]
    bound=q.replace('?1','NULL' if value is None else str(value))
    rows,_=o.query(d,db,bound)
    runs.append(dict(bindings=run['bindings'],rows=rows))
   cases.append(dict(c,sql=q,runs=runs))
   continue
  rows,_=o.query(d,db,q);ops,_=o.query(d,db,'EXPLAIN '+q)
  # LIMIT changes the outer row set (including unmatched LEFT rows). Its
  # expected result is captured independently, never copied from the base case.
  if not a.retained_limit:assert rows==c['rows']
  names=[bytes.fromhex(x[1].get('utf8Hex','')).decode() for x in ops]
  assert 'SeekGE' in names
  # The ordinary derived source may flatten upstream; retain the actual plan.
  cases.append(dict(c,sql=q,rows=rows,ops=ops,metadata=metadata(q)))
 if a.grouped:
  template=next(c for c in v['cases'] if c['name']=='correlated')
  # Same destination boundary: HAVING, actual aggregate EList, and the
  # non-first SrcItem callable materialization alternative to a coroutine.
  for name,producer in [('having','(SELECT k FROM outer_t GROUP BY k HAVING count(*)>0) AS o'),('aggregate','(SELECT max(k) AS k FROM outer_t GROUP BY k) AS o'),('ungrouped','(SELECT min(k) AS k FROM outer_t) AS o')]:
   q=template['sql'].replace('outer_t AS o',producer)
   rows,_=o.query(d,db,q);ops,_=o.query(d,db,'EXPLAIN '+q)
   cases.append(dict(template,name=name,sql=q,rows=rows,ops=ops,metadata=metadata(q)))
  q=template['sql'].replace('outer_t AS o','outer_t AS p CROSS JOIN (SELECT k FROM outer_t GROUP BY k) AS o').replace('WHERE (t.a,t.b)','WHERE p.k=1 AND (t.a,t.b)')
  rows,_=o.query(d,db,q);ops,_=o.query(d,db,'EXPLAIN '+q)
  cases.append(dict(template,name='materialized-group',sql=q,rows=rows,ops=ops,metadata=metadata(q)))
 assert d.sqlite3_close(db)==0
 v['fixture']='base/'+v['fixture'];v['cases']=cases
(root/'native.json').write_text(json.dumps(r))
