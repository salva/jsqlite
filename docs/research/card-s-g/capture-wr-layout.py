#!/usr/bin/env python3
"""Native-first redundant WR declared/PK physical layouts, immutable new fixtures."""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);a=p.parse_args();d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];base=ROOT/'docs/research/card-s-g';variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 f=base/'wr-layout'/f'{enc.lower()}.db';f.parent.mkdir(exist_ok=True);assert not f.exists()
 db=C.c_void_p();assert d.sqlite3_open(str(f).encode(),C.byref(db))==0
 n.execsql(d,db,f"PRAGMA page_size=512;PRAGMA encoding='{enc}';CREATE TABLE w(a TEXT COLLATE NOCASE,b INTEGER,c INTEGER,d TEXT,PRIMARY KEY(a,a,b)) WITHOUT ROWID;CREATE INDEX same ON w(c,a COLLATE NOCASE);CREATE INDEX different ON w(c,a COLLATE BINARY);CREATE INDEX redundant ON w(c,c,a COLLATE NOCASE);")
 n.execsql(d,db,"WITH RECURSIVE r(i) AS (VALUES(0) UNION ALL SELECT i+1 FROM r WHERE i<3999) INSERT INTO w SELECT CASE WHEN i%2=0 THEN 'Alpha' ELSE 'Beta' END,i,i/1000,'value'||i FROM r; ANALYZE;")
 assert d.sqlite3_close(db)==0;sha=hashlib.sha256(f.read_bytes()).hexdigest();db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0;cases=[]
 for index in ['same','different','redundant']:
  for projection in ['a,b,c','a,b,c,d']:
   predicate="a='Alpha' COLLATE NOCASE AND b>=3990" if index!='different' else "a='Alpha' COLLATE BINARY AND a='alpha' COLLATE NOCASE AND b>=3990"
   sql=f'SELECT {projection} FROM w INDEXED BY {index} WHERE {predicate} ORDER BY b';rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());nSkip=max([line.count('ANY(') for line in eqp]+[0]);assert nSkip>0,eqp;assert rows
   cases.append({'sql':sql,'rows':rows,'eqp':eqp,'nSkip':nSkip,'opcodes':[{'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in n.query(d,db,'EXPLAIN '+sql)[0]],'counters':counters})
 assert d.sqlite3_close(db)==0;assert sha==hashlib.sha256(f.read_bytes()).hexdigest();variants.append({'encoding':enc,'control':'tail','tail':'18','fixture':'wr-layout/'+f.name,'sha256':sha,'cases':cases})
(base/'wr-layout-native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'before any layout-driven consuming repair; independent new real ANALYZE companions','variants':variants},indent=2)+'\n');print('PASS18 native selected WR layout companions')
