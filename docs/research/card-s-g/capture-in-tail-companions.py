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
 for sql in ["SELECT id,a,b,c FROM s INDEXED BY sa WHERE b IN (1,2,NULL,1) AND c IN (3,5,NULL) AND id>0 ORDER BY a DESC,b,c,id", "SELECT a,b,c FROM w INDEXED BY wc WHERE a IN ('Alpha','Alpha',NULL) COLLATE BINARY AND a IN ('alpha',NULL) COLLATE NOCASE AND b IN (2,4,6,NULL) ORDER BY c DESC,b", "SELECT a,b,c FROM w INDEXED BY wc WHERE a IN ('Alpha',NULL) COLLATE BINARY AND b IN (2,4,6,NULL) ORDER BY c DESC,b"]:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':n.explain(d,db,'EXPLAIN ',sql,()),'counters':counters,'nSkip':sum(line.count('ANY(') for line in eqp)})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':'tail','tail':'18','fixture':'fixtures/'+v['fixture']['path'],'sha256':v['fixture']['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after rowid-tail recursion repair; before IN-tail consuming evidence/any further repair','variants':variants},indent=2)+'\n');print('PASS:9 native nested-IN tail companions')
