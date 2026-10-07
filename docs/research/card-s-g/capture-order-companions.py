#!/usr/bin/env python3
"""Native selected skip ordering controls before order owner correction."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g';variants=[]
for v in json.loads((base/'primitive-companions/native.json').read_text())['variants']:
 if v['tail'] not in ['18','18 unordered']:continue
 f=base/'primitive-companions'/v['fixture'];assert hashlib.sha256(f.read_bytes()).hexdigest()==v['sha256']
 db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql in ['SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a','SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a DESC','SELECT a,b FROM t INDEXED BY ad WHERE b=7 ORDER BY a ASC','SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a COLLATE NOCASE']:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());assert any('ANY(' in line for line in eqp)
  # bUnordered suppresses ordering credit; collation mismatch independently forces sorter.
  expected=v['tail']=='18 unordered' or 'NOCASE' in sql
  assert any('TEMP B-TREE' in line for line in eqp)==expected,(sql,eqp)
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':n.explain(d,db,'EXPLAIN ',sql,()),'counters':counters,'nSkip':1})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':v['tail'],'tail':'18','fixture':'primitive-companions/'+v['fixture'],'sha256':v['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after dormant wiring before unordered order owner correction','variants':variants},indent=2)+'\n');print('PASS:24 native selected skip ordering controls')
