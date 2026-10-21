#!/usr/bin/env python3
"""Finite native useful-selection search; disposable fixtures under card work."""
import ctypes as C, importlib.util, json, os, pathlib, sys
from compact_captures import search_summary
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('n',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
libs=[n.load(p) for p in sys.argv[1:3]];pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert all(d.sqlite3_sourceid().decode()==pin['sqliteSourceId'] for d in libs)
work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'skiprange-search';work.mkdir(exist_ok=True)
results=[]
for hot in [0,1000]:
 for prefixes in [2,20,100]:
  for competitor in [False,True]:
   path=work/'search.db';path.unlink(missing_ok=True);db=C.c_void_p();d=libs[0];assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
   setup=f"CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER,p TEXT);CREATE INDEX ab ON t(a,b);"+('CREATE INDEX ci ON t(c);' if competitor else '')+f"WITH RECURSIVE x(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<20000) INSERT INTO t SELECT i,i%{prefixes},CASE WHEN i<=19800 THEN {hot} ELSE i-19800 END,i%7,'payload-'||i FROM x;ANALYZE;"
   n.execsql(d,db,setup);assert d.sqlite3_close(db)==0
   for pred in ['b>100','b<100','b>199','b<1','b>=1000','b BETWEEN 190 AND 200','b>0 AND b<10']:
    sql='SELECT id,p FROM t WHERE '+pred+(' AND c=1' if competitor else '')
    runs=[]
    for d in libs:
     assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
     rows,counters=n.query(d,db,sql);eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[]);assert d.sqlite3_close(db)==0
     runs.append({'rows':sorted(rows,key=lambda r:int(r[0]['value'])),'eqp':eqp,'work':counters})
    assert runs[0]['rows']==runs[1]['rows']
    if runs[0]['eqp']!=runs[1]['eqp']:
     r={'hot':hot,'prefixes':prefixes,'competitor':competitor,'sql':sql,'setup':setup,'stat4':runs[0],'control':runs[1]};results.append(r)
     print(hot,prefixes,competitor,pred,runs[0]['eqp'],runs[0]['work']['vmSteps'],'vs',runs[1]['eqp'],runs[1]['work']['vmSteps'],flush=True)
raw={'sourceId':pin['sqliteSourceId'],'fixtures':12,'queriesPerFixture':7,'differences':results}
(work/'skiprange-search.raw.json').write_text(json.dumps(raw,indent=2)+'\n')
(work/'skiprange-search.json').write_text(json.dumps(search_summary(raw),indent=2)+'\n')
