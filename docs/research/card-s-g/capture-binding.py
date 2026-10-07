#!/usr/bin/env python3
"""Typed parameter reruns on one pinned statement, immutable selected DESC fixtures."""
import ctypes as C,importlib.util,pathlib,json,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3];s=importlib.util.spec_from_file_location('n',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n);d=n.load(sys.argv[1]);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];variants=[]
for enc in ['utf-8','utf-16le','utf-16be']:
 f=ROOT/'docs/research/card-s-g/desc-selected'/f'{enc}.db';sha=hashlib.sha256(f.read_bytes()).hexdigest();db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0;cases=[]
 for sql in ['SELECT rowid,a,b,c,?1 FROM t WHERE b>=?1 AND b<=?2 ORDER BY rowid','SELECT rowid,a,b,c,?1 FROM t WHERE b IS ?1 AND c IN (1,12) ORDER BY rowid']:
  eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[998,999] if '?2' in sql else [998]);assert any('ANY(a)' in line for line in eqp);st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0;runs=[]
  for value in [998,998.0,998.5,'998',None,999.0,998]:
   values=[value,999] if '?2' in sql else [value];assert d.sqlite3_reset(st)==0;assert d.sqlite3_clear_bindings(st)==0;n.bind(d,st,values);rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==100:rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))]);continue
    assert rc==101;break
   runs.append({'bindings':values,'bindingTypes':['real' if isinstance(v,float) else 'integer' if isinstance(v,int) else 'null' if v is None else 'text' for v in values],'rows':rows})
  assert d.sqlite3_finalize(st)==0;cases.append({'sql':sql,'eqp':eqp,'nSkip':1,'runs':runs})
 assert d.sqlite3_close(db)==0;assert sha==hashlib.sha256(f.read_bytes()).hexdigest();variants.append({'encoding':enc,'control':'tail','tail':'18','fixture':'desc-selected/'+f.name,'sha256':sha,'cases':cases})
(ROOT/'docs/research/card-s-g/binding-native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'same-native-statement typed reset/rebind before any corresponding runtime repair','variants':variants},indent=2)+'\n');print('PASS6 native statements42 typed binding runs')
