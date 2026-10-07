#!/usr/bin/env python3
"""Native physical suffix companions before producer extension."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
base=ROOT/'docs/research/card-s-g';variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 f=base/'desc-selected'/f'{enc.lower()}.db';f.parent.mkdir(exist_ok=True)
 assert not f.exists(), 'do not overwrite delivered fixtures'
 db=C.c_void_p();assert d.sqlite3_open(str(f).encode(),C.byref(db))==0
 n.execsql(d,db,f"PRAGMA page_size=512; PRAGMA encoding='{enc}'; CREATE TABLE t(a INTEGER,b INTEGER,c INTEGER); CREATE INDEX ad ON t(a DESC,b DESC,c DESC);")
 n.execsql(d,db,"WITH RECURSIVE r(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM r WHERE i<3999) INSERT INTO t SELECT i/1000,i%1000,i%17 FROM r; ANALYZE;")
 assert d.sqlite3_close(db)==0
 sha=hashlib.sha256(f.read_bytes()).hexdigest()
 v={'encoding':enc,'fixture':f.name,'sha256':sha}
 db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql in ['SELECT rowid,a,b,c FROM t WHERE b>997 OR b=1 ORDER BY rowid', 'SELECT rowid,a,b,c FROM t WHERE b<2 OR b=999 ORDER BY rowid', 'SELECT rowid,a,b,c FROM t WHERE b>=999 OR b=0 ORDER BY rowid', 'SELECT rowid,a,b,c FROM t WHERE b<=0 OR b=998 ORDER BY rowid', 'SELECT rowid,a,b,c FROM t WHERE b IN (1,998,NULL) AND c IN (1,12,NULL) ORDER BY rowid', 'SELECT t.rowid,t.a,t.b,t.c FROM t AS x CROSS JOIN t WHERE x.rowid=1 AND (t.b>997 OR t.b=1) ORDER BY t.rowid']:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
  cases.append({'sql':sql,'rows':rows,'eqp':eqp,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters,'nSkip':max([line.count('ANY(') for line in eqp]+[0])})
 assert d.sqlite3_close(db)==0
 variants.append({'encoding':v['encoding'],'control':'tail','tail':'18','fixture':'desc-selected/'+v['fixture'],'sha256':v['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'before constraint-equals-nSkip no-reseek repair','variants':variants},indent=2)+'\n');print('PASS:18 native selected DESC companions')
