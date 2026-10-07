#!/usr/bin/env python3
"""Joined recursive OR companion, read-only inherited native-first databases.
Capture after dormant wiring, before subsequent case-driven runtime changes.
"""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g';variants=[]
for v in json.loads((base/'native.json').read_text())['variants']:
 if v['control']!='stat1':continue
 f=base/'fixtures'/v['fixture']['path'];assert hashlib.sha256(f.read_bytes()).hexdigest()==v['fixture']['sha256']
 db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 sql='SELECT s.id,s.a,s.b,s.c,s.p FROM t1 CROSS JOIN s WHERE t1.d=5 AND ((s.b=2 AND s.c>=5) OR s.c=6) ORDER BY s.id'
 rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());assert any('MULTI-INDEX OR' in line for line in eqp),eqp
 opcodes=n.explain(d,db,'EXPLAIN ',sql,())
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'tail':'18','fixture':'fixtures/'+v['fixture']['path'],'sha256':v['fixture']['sha256'],'cases':[{'sql':sql,'rows':rows,'eqp':eqp,'opcodes':opcodes,'counters':counters,'nSkip':2}]})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after dormant wiring; before subsequent case-driven runtime changes','variants':variants},indent=2)+'\n')
print('PASS:3 independent joined multi-OR read-only captures')
