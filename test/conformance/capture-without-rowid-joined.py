#!/usr/bin/env python3
"""Development-only, manifest-checked read-only joined WR controls. Never runtime."""
import argparse,ctypes as C,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);args=p.parse_args();d=m.load(args.library)
pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+n);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
original=json.loads((ROOT/'test/conformance/cases/row-width-wr-joined-native.json').read_text());out={'sourceId':pin['sqliteSourceId'],'producer':'test/conformance/capture-without-rowid-joined.py','variants':[]}
for v in original['variants']:
 db=C.c_void_p();assert d.sqlite3_open_v2(str(ROOT/v['fixture']).encode(),C.byref(db),1,None)==0;cases=[]
 for sql,bindings in [(original['sql'],[[],[],[]]),("SELECT x.a,y.b,hex(y.c) FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.c=?1 ORDER BY x.a,y.b",[[{'type':'blob','hex':'ff'}],[{'type':'blob','hex':'00'}],[{'type':'blob','hex':'ff'}]])]:
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  metadata=[{n:(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']} for i in range(3)];runs=[]
  for values in bindings:
   assert d.sqlite3_reset(st)==0;assert d.sqlite3_clear_bindings(st)==0;m.bind(d,st,values);rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==100:rows.append([m.cell(d,st,i) for i in range(3)])
    else:break
   assert rc==101;runs.append({'bindings':values,'rows':rows})
  assert d.sqlite3_finalize(st)==0;cases.append({'sql':sql,'metadata':metadata,'runs':runs,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,bindings[0]),'program':m.explain(d,db,'EXPLAIN ',sql,bindings[0])})
 assert d.sqlite3_close(db)==0
 suffix={'UTF-8':'utf8','UTF-16le':'utf16le','UTF-16be':'utf16be'}[v['encoding']];file=f'test/conformance/fixtures/advanced-index-{suffix}.db';assert d.sqlite3_open_v2(str(ROOT/file).encode(),C.byref(db),1,None)==0;lookup=[]
 for projection in ['y.a,y.b','y.a,y.payload']:
  sql=f'SELECT {projection} FROM wr x CROSS JOIN wr y INDEXED BY wr_c WHERE y.c=?1 AND x.a=y.a ORDER BY y.a,y.b';runs=[]
  for values in [[2.5],[1.0],[None],[2.5]]:rows,counters=m.query(d,db,sql,values);runs.append({'bindings':values,'rows':rows,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,values),'program':m.explain(d,db,'EXPLAIN ',sql,values)})
  lookup.append({'sql':sql,'runs':runs,'eqpBindings':runs[0]['bindings'],'eqp':runs[0]['eqp'],'program':runs[0]['program']})
 assert d.sqlite3_close(db)==0;out['variants'].append({'encoding':v['encoding'],'cases':cases,'lookupFixture':file,'lookup':lookup})
 # Post-runtime native controls, not retroactive native-FIRST or TS budget equivalence.
 assert d.sqlite3_open_v2(str(ROOT/v['fixture']).encode(),C.byref(db),1,None)==0
 progress=C.CFUNCTYPE(C.c_int,C.c_void_p)(lambda _:1)
 d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,C.c_void_p,C.c_void_p]
 d.sqlite3_limit.argtypes=[C.c_void_p,C.c_int,C.c_int];d.sqlite3_limit.restype=C.c_int
 controls=[]
 for kind in ['progress-interrupt','length-limit']:
  controlSql=original['sql'] if kind=='progress-interrupt' else "SELECT x.a,y.b,hex(zeroblob(100)) FROM w x CROSS JOIN w y NOT INDEXED WHERE y.a=x.a ORDER BY x.a,y.b"
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,controlSql.encode(),-1,C.byref(st),None)==0
  if kind=='progress-interrupt':d.sqlite3_progress_handler(db,1,progress,None)
  else:old=d.sqlite3_limit(db,0,1) # SQLITE_LIMIT_LENGTH, not VM-work units.
  step=d.sqlite3_step(st);reset=d.sqlite3_reset(st)
  if kind=='progress-interrupt':d.sqlite3_progress_handler(db,0,None,None)
  else:d.sqlite3_limit(db,0,old)
  rows=[]
  while True:
   rc=d.sqlite3_step(st)
   if rc==100:rows.append([m.cell(d,st,i) for i in range(3)])
   else:break
  final=d.sqlite3_finalize(st)
  assert step==({'progress-interrupt':9,'length-limit':18}[kind]) and reset==step and rc==101 and final==0,(kind,step,reset,rc,final)
  controls.append({'kind':kind,'timing':'post-runtime','sql':controlSql,'bindings':[],'stepCode':step,'resetCode':reset,'recoveryRows':rows,'recoveryCode':rc,'finalizeCode':final,'tsBudgetEquivalent':False})
 assert d.sqlite3_close(db)==0
 out['variants'][-1]['postRuntimeNativeControls']=controls
pathlib.Path(args.output).write_text(json.dumps(out,indent=2)+'\n');print('Pinned joined WR:6 metadata/reset controls +6 covering/required-primary controls in three encodings')
