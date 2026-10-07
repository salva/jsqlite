#!/usr/bin/env python3
"""Independent mixed NULL/IN/collation and LEFT/OR native selection controls."""
import ctypes as C,importlib.util,pathlib,json,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3];s=importlib.util.spec_from_file_location('n',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n);d=n.load(sys.argv[1]);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];variants=[]
queries=[
 'SELECT rowid,a,b,c FROM t WHERE b IS NOT NULL AND c IN (1,12)',
 'SELECT rowid,a,b,c FROM t WHERE b IS NULL AND c IN (1,12)',
 'SELECT rowid,a,b,c FROM t WHERE b IN (1,998) AND c IS NOT NULL',
 'SELECT rowid,a,b,c FROM t WHERE b IN (1,998) AND c IN (1,12)',
 "SELECT rowid,a,b,c FROM t WHERE b IN ('1','998') AND c IN (1,12) COLLATE NOCASE",
 "SELECT rowid,a,b,c FROM t WHERE b COLLATE NOCASE IN ('1','998') AND c IN (1,12)",
 'SELECT t.rowid,t.a,t.b,t.c FROM t AS x LEFT JOIN t ON (t.b>998 OR t.b<1) WHERE x.rowid=1',
 'SELECT t.rowid,t.a,t.b,t.c FROM t AS x LEFT JOIN t ON (t.b>1005 OR t.b<0) WHERE x.rowid=1',
 'SELECT t.rowid,t.a,t.b,t.c FROM t AS x LEFT JOIN t ON (t.b=1 AND t.c=1) OR (t.b=998 AND t.c=12) WHERE x.rowid=1',
 'SELECT t.rowid,t.a,t.b,t.c FROM t AS x CROSS JOIN t WHERE x.rowid=1 AND ((t.b=1 AND t.c=1) OR t.b>998) AND t.c=12',
]
for enc in ['utf-8','utf-16le','utf-16be']:
 f=ROOT/'docs/research/card-s-g/desc-selected'/f'{enc}.db';sha=hashlib.sha256(f.read_bytes()).hexdigest();db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0;cases=[]
 for sql in queries:
  rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());cases.append({'sql':sql,'rows':rows,'eqp':eqp,'nSkip':max([line.count('ANY(') for line in eqp]+[0]),'counters':counters})
 assert d.sqlite3_close(db)==0;assert sha==hashlib.sha256(f.read_bytes()).hexdigest();variants.append({'encoding':enc,'control':'tail','tail':'18','fixture':'desc-selected/'+f.name,'sha256':sha,'cases':cases})
(ROOT/'docs/research/card-s-g/mixed-native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'independent read-only capture before corresponding runtime repair if needed','variants':variants},indent=2)+'\n');print('PASS30 mixed native cases, selected',sum(c['nSkip']>0 for v in variants for c in v['cases']))
