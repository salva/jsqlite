#!/usr/bin/env python3
"""Native physical suffix companions before producer extension."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g';variants=[]
for v in json.loads((base/'primitive-companions/native.json').read_text())['variants']:
 if v['tail']!='18':continue
 f=base/'primitive-companions'/v['fixture'];assert hashlib.sha256(f.read_bytes()).hexdigest()==v['sha256']
 db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql in ['SELECT rowid,a,b FROM t INDEXED BY ad WHERE b>27 OR b=1 ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b<2 OR b=29 ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b>=29 OR b IS NULL ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b<=1 OR b IS NULL ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b>29 AND b<31 ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b>=29 AND b<=30 ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b IS NOT NULL ORDER BY rowid', 'SELECT rowid,a,b FROM t INDEXED BY ad WHERE b IN (1,29,NULL) ORDER BY rowid','SELECT t.rowid,t.a,t.b FROM t AS x CROSS JOIN t INDEXED BY ad WHERE x.rowid=1 AND (t.b>29 OR t.b=1) ORDER BY t.rowid','SELECT t.rowid,t.a,t.b FROM t AS x CROSS JOIN t INDEXED BY ad WHERE x.rowid=1 AND (t.b<1 OR t.b=29) ORDER BY t.rowid','SELECT t.rowid,t.a,t.b FROM t AS x CROSS JOIN t INDEXED BY ad WHERE x.rowid=1 AND (t.b>=30 OR t.b IS NULL) ORDER BY t.rowid','SELECT t.rowid,t.a,t.b FROM t AS x CROSS JOIN t INDEXED BY ad WHERE x.rowid=1 AND (t.b<=0 OR t.b IS NULL) ORDER BY t.rowid']:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters,'nSkip':max([line.count('ANY(') for line in eqp]+[0])})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':'tail','tail':'18','fixture':'primitive-companions/'+v['fixture'],'sha256':v['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'before constraint-equals-nSkip no-reseek repair','variants':variants},indent=2)+'\n');print('PASS:36 native physical DESC companions')
