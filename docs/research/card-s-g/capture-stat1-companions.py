#!/usr/bin/env python3
"""Native-first malformed numeric/tail stat1 admission companions; original bytes immutable."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output-dir',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g';out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True);variants=[]
for v in json.loads((base/'primitive-companions/native.json').read_text())['variants']:
 if v['tail']!='18':continue
 original=base/'primitive-companions'/v['fixture'];raw=original.read_bytes();assert hashlib.sha256(raw).hexdigest()==v['sha256']
 for kind,stat in [('missing','4000'),('double-space','4000  18 1'),('junk','4000 junk 1'),('overflow','4000 18446744073709551634 1'),('zero','4000 0 1'),('tail-noskip','4000 18 1 noskipscan'),('tail-unordered','4000 18 1 unordered')]:
  f=out/f"{v['encoding'].lower()}-{kind}.db";f.write_bytes(raw)
  db=C.c_void_p();assert d.sqlite3_open(str(f).encode(),C.byref(db))==0
  n.execsql(d,db,f"UPDATE sqlite_stat1 SET stat='{stat}' WHERE idx='ab';");assert d.sqlite3_close(db)==0
  db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
  cases=[]
  for sql in ['SELECT b FROM t INDEXED BY ab WHERE b=7','SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a DESC']:
   rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());selected=any('ANY(' in line for line in eqp)
   cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':n.explain(d,db,'EXPLAIN ',sql,()),'counters':counters,'nSkip':1 if selected else 0})
  assert d.sqlite3_close(db)==0
  variants.append({'encoding':v['encoding'],'control':kind,'stat':stat,'tail':'18','fixture':'stat1-companions/'+f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'originalSha256':v['sha256'],'cases':cases})
(out/'native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'after dormant wiring before malformed-stat case-driven repairs','variants':variants},indent=2)+'\n');print('PASS:42 read-only native stat1 admission captures');print([(v['control'],[c['nSkip'] for c in v['cases']]) for v in variants[:7]])
