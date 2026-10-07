#!/usr/bin/env python3
"""Native physical suffix companions before producer extension."""
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
 cases=[]
 for sql in ["SELECT s.id,s.a,s.b,s.c FROM t1 CROSS JOIN s INDEXED BY sa WHERE t1.d=5 AND s.a IS NOT NULL ORDER BY s.a DESC", "SELECT s.id,s.a,s.b,s.c FROM t1 CROSS JOIN s INDEXED BY sa WHERE t1.d=5 AND s.a>=NULL ORDER BY s.a DESC","SELECT id,a,b,c FROM s INDEXED BY sa WHERE a IS NOT NULL ORDER BY a DESC", "SELECT id,a,b,c FROM s INDEXED BY sa WHERE a IS NOT NULL ORDER BY a", "SELECT id,a,b,c FROM s INDEXED BY sa WHERE a>=NULL ORDER BY a DESC","SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IS NOT NULL ORDER BY a DESC,b DESC", "SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IS NOT NULL ORDER BY a,b", "SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IS NULL AND b IS NOT NULL ORDER BY id", "SELECT s.id,s.a,s.b,s.c FROM t1 CROSS JOIN s INDEXED BY sa WHERE t1.d=5 AND s.b IS NOT NULL ORDER BY s.a DESC,s.b DESC", "SELECT id,a,b,c FROM s INDEXED BY sa WHERE b>=NULL ORDER BY a DESC,b DESC"]:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters,'nSkip':max([line.count('ANY(') for line in eqp]+[0])})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':'tail','tail':'18','fixture':'fixtures/'+v['fixture']['path'],'sha256':v['fixture']['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after initial NOTNULL repair, before any direction/end repair','variants':variants},indent=2)+'\n');print('PASS:30 native NOTNULL direction/control companions')
