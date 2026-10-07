#!/usr/bin/env python3
"""Pinned native companions before strict-prefix primitive changes; originals untouched."""
import argparse, ctypes as C, importlib.util, json, pathlib, sys, hashlib
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py'); n=importlib.util.module_from_spec(s); s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output-dir',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for tail in ['18','17','18 noskipscan','18 unordered','none','empty']:
  name=f"{enc.lower()}-{tail.replace(' ','-')}.db";f=out/name;f.unlink(missing_ok=True)
  db=C.c_void_p();assert d.sqlite3_open(str(f).encode(),C.byref(db))==0
  n.execsql(d,db,f"PRAGMA page_size=512; PRAGMA encoding='{enc}'; CREATE TABLE t(a INTEGER,b INTEGER,c TEXT); CREATE INDEX ab ON t(a,b); CREATE INDEX ad ON t(a DESC,b DESC);")
  if tail!='empty':n.execsql(d,db,"WITH RECURSIVE r(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM r WHERE i<3999) INSERT INTO t SELECT CASE WHEN i<200 THEN NULL ELSE i/200 END,CASE WHEN i%31=0 THEN NULL ELSE i%31 END,printf('%08d',i) FROM r;")
  n.execsql(d,db,'ANALYZE;')
  if tail=='none':n.execsql(d,db,'DELETE FROM sqlite_stat1;')
  else:n.execsql(d,db,f"UPDATE sqlite_stat1 SET stat='4000 {tail if tail!='empty' else '18'} 1';")
  d.sqlite3_close(db);db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
  cases=[]
  for sql in ['SELECT a,b FROM t INDEXED BY ab WHERE b=7','SELECT a,b FROM t INDEXED BY ab WHERE b IS NULL','SELECT a,b FROM t INDEXED BY ad WHERE b>7 AND b<9','SELECT a,b FROM t INDEXED BY ab WHERE b IN (7,NULL,8) AND a IS NOT NULL','SELECT a,b FROM t INDEXED BY ab ORDER BY a,b']:
   rows,counters=n.query(d,db,sql);cases.append({'sql':sql,'rows':rows,'eqp':n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,()),'opcodes':n.explain(d,db,'EXPLAIN ',sql,()),'counters':counters})
  roots=n.query(d,db,"SELECT name,rootpage FROM sqlite_schema WHERE type='index' ORDER BY name")[0]
  d.sqlite3_close(db);variants.append({'encoding':enc,'tail':tail,'fixture':name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'roots':roots,'cases':cases})
result={'sourceId':pin['sqliteSourceId'],'runtimeChangesBeforeCapture':False,'variants':variants}
(out/'native.json').write_text(json.dumps(result,indent=2)+'\n')
for v in variants:
 selected=any('ANY(a)' in line for line in v['cases'][0]['eqp'])
 assert selected==(v['tail'] in ['18','18 unordered']),(v['encoding'],v['tail'],v['cases'][0]['eqp'])
print('PASS:18 native-first companions; threshold18/17, noskipscan, unordered, noStats, empty; 90 captures')
