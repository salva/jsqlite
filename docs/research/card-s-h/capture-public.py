#!/usr/bin/env python3
"""Metadata and same-prepared-statement parameter/reset oracle, development only."""
import ctypes as C, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(__file__).parent
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(sys.argv[1]);first=json.loads((out/'first-native.json').read_text());assert d.sqlite3_sourceid().decode()==first['profiles'][0]['sourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
results=[]
for v in first['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(out/v['fixture']).encode(),C.byref(db),1,None)==0
 cases=[]
 for case in v['stat4']:
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(st),None)==0
  meta=[{key:(getattr(d,'sqlite3_column_'+native)(st,i) or b'').decode() or None for key,native in [('name','name'),('declaredType','decltype'),('databaseName','database_name'),('tableName','table_name'),('originName','origin_name')]} for i in range(d.sqlite3_column_count(st))]
  assert d.sqlite3_finalize(st)==0;cases.append({'id':case['id'],'metadata':meta})
 sql='SELECT id,r,b FROM t WHERE a=? ORDER BY id';st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 runs=[]
 for value in [99,0,None,98]:
  assert d.sqlite3_reset(st)==0;assert d.sqlite3_clear_bindings(st)==0;n.bind(d,st,[value]);rows=[]
  while (rc:=d.sqlite3_step(st))==100:rows.append([n.cell(d,st,i) for i in range(3)])
  assert rc==101;runs.append({'binding':value,'rows':rows,'eqp':n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[value])})
 assert d.sqlite3_finalize(st)==0
 # Invalid SQL is a prepare error independent of STAT4; preserve its numeric outcome.
 st=C.c_void_p();errorRc=d.sqlite3_prepare_v2(db,b'SELECT missing FROM t',-1,C.byref(st),None);assert errorRc==1
 assert d.sqlite3_close(db)==0;results.append({'encoding':v['encoding'],'cases':cases,'parameterSql':sql,'bindingRuns':runs,'invalidSqlPrepareRc':errorRc})
(out/'public-native.json').write_text(json.dumps(results,indent=2)+'\n');print('metadata, parameters/reset and prepare errors:',len(results),'encodings')
