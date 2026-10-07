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
 for sql in ["SELECT s.id,u.id FROM s INDEXED BY sa JOIN s AS u INDEXED BY sa ON s.a=u.a WHERE u.a='Alpha' AND s.b=1 AND s.c=2 ORDER BY s.id,u.id", "SELECT s.id,u.id FROM s INDEXED BY sa LEFT JOIN s AS u INDEXED BY sa ON s.a=u.a AND u.b=1 WHERE s.a='Alpha' AND s.b=1 AND s.c=2 ORDER BY s.id,u.id", "SELECT s.id,u.id FROM s INDEXED BY sa JOIN s AS u INDEXED BY sa ON u.a=s.a WHERE u.a='Alpha' AND s.b=1 AND s.c IS NULL ORDER BY s.id,u.id"]:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters,'nSkip':0})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':'tail','tail':'18','fixture':'fixtures/'+v['fixture']['path'],'sha256':v['fixture']['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'before ordinary transitive scalar handoff','variants':variants},indent=2)+'\n');print('PASS:9 native scalar transitive companions')
