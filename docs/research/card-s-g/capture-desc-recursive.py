#!/usr/bin/env python3
"""Read-only pinned capture: selected physical DESC recursive OR, no stat tuning."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 f=ROOT/'docs/research/card-s-g/desc-selected'/f'{enc.lower()}.db';sha=hashlib.sha256(f.read_bytes()).hexdigest();db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0;cases=[]
 for predicate in ['b>998 OR b<1','b>998 OR (b=1 AND c=1)','(b=1 AND c=1) OR (b=998 AND c=12)']:
  for sql in [f'SELECT rowid,a,b,c FROM t WHERE {predicate}',f'SELECT t.rowid,t.a,t.b,t.c FROM t AS x CROSS JOIN t WHERE x.rowid=1 AND ({predicate.replace('b','t.b').replace('c','t.c')})']:
   rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());assert any('MULTI-INDEX OR' in line for line in eqp),eqp;assert any('ANY(a)' in line for line in eqp),eqp
   cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters,'nSkip':1})
 assert d.sqlite3_close(db)==0;assert sha==hashlib.sha256(f.read_bytes()).hexdigest();variants.append({'encoding':enc,'control':'tail','tail':'18','fixture':'desc-selected/'+f.name,'sha256':sha,'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'read-only companions before any corresponding new runtime repair; inherited canonical runtime unchanged','variants':variants},indent=2)+'\n');print('PASS:18 selected physical DESC recursive OR companions, immutable fixtures')
