#!/usr/bin/env python3
"""Pinned development-only beta.3 skipscan-range discrimination, no TS runtime edits."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys, os
from compact_captures import regression_capture
ROOT=pathlib.Path(__file__).resolve().parents[3];out=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'skiprange-capture';out.mkdir(parents=True,exist_ok=True)
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());profiles=[]
for lib in sys.argv[1:3]:
 d=n.load(lib);assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];d.sqlite3_compileoption_get.argtypes=[C.c_int];d.sqlite3_compileoption_get.restype=C.c_char_p
 options=[];i=0
 while (v:=d.sqlite3_compileoption_get(i)):options.append(v.decode());i+=1
 profiles.append({'sourceId':pin['sqliteSourceId'],'librarySha256':hashlib.sha256(pathlib.Path(lib).read_bytes()).hexdigest(),'compileOptions':options})
assert 'ENABLE_STAT4' in profiles[0]['compileOptions'] and 'ENABLE_STAT4' not in profiles[1]['compileOptions']
cases=[]
for pred in ['b>100','b<0','b<1','b>=190','b<0 AND b>-10']:
 cases.append({'id':'unordered-'+pred,'sql':f'SELECT id,p FROM t WHERE {pred}','bindings':[]})
for pred in ['b>100','b>=0','b>0','b BETWEEN 100 AND 120','b>100 AND b<101','b>NULL','b>100.0',"b>'100'",'b>?']:
 cases.append({'id':pred,'sql':f'SELECT id,p FROM t WHERE {pred} ORDER BY id','bindings':[100] if '?' in pred else []})
cases.extend([{'id':'forced-ab','sql':'SELECT id,p FROM t INDEXED BY ab WHERE b>100 ORDER BY id','bindings':[]},{'id':'forced-scan','sql':'SELECT id,p FROM t NOT INDEXED WHERE b>100 ORDER BY id','bindings':[]},{'id':'covering','sql':'SELECT b FROM t WHERE b>100 ORDER BY b','bindings':[]}])
if '--useful' in sys.argv:
 out=out/'skiprange-useful';out.mkdir(exist_ok=True)
 cases=[{'id':'unordered-'+pred,'sql':f'SELECT id,p FROM t WHERE {pred} AND c=1','bindings':[]} for pred in ['b>100','b>199','b>=1000','b>100.0',"b>'100'",'b>NULL']]
 cases.extend([{'id':'unordered-param','sql':'SELECT id,p FROM t WHERE b>? AND c=1','bindings':[100]},{'id':'unordered-forced-ci','sql':'SELECT id,p FROM t INDEXED BY ci WHERE b>100 AND c=1','bindings':[]}])
variants=[];d=n.load(sys.argv[1])
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/f'skiprange-{enc}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 setup=f"PRAGMA encoding='{enc}';CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER,c INTEGER,p TEXT);CREATE INDEX ab ON t(a,b);CREATE INDEX ci ON t(c);WITH RECURSIVE x(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<20000) INSERT INTO t SELECT i,i%20,CASE WHEN i<=19800 THEN 0 ELSE i-19800 END,i%7,'payload-'||i FROM x;ANALYZE;"
 if '--useful' not in sys.argv:setup=setup.replace('CREATE INDEX ci ON t(c);','')
 n.execsql(d,db,setup);samples,_=n.query(d,db,'SELECT tbl,idx,neq,nlt,ndlt,sample FROM sqlite_stat4 ORDER BY rowid');stat1,_=n.query(d,db,'SELECT * FROM sqlite_stat1');assert d.sqlite3_close(db)==0
 captures=[]
 for lib in sys.argv[1:3]:
  q=n.load(lib);assert q.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0;runs=[]
  for case in cases:
   rows,work=n.query(q,db,case['sql'],case['bindings']);runs.append({**case,'rows':rows,'eqp':n.explain(q,db,'EXPLAIN QUERY PLAN ',case['sql'],case['bindings']),'program':n.explain(q,db,'EXPLAIN ',case['sql'],case['bindings']),'work':work})
  captures.append(runs);assert q.sqlite3_close(db)==0
 for a,b in zip(captures[0],captures[1]):
  ar,br=a['rows'],b['rows']
  if a['id'].startswith('unordered-'):ar=sorted(ar,key=lambda r:int(r[0]['value']));br=sorted(br,key=lambda r:int(r[0]['value']))
  assert ar==br,a['id']
 variants.append({'encoding':enc,'fixture':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'setup':setup,'stat1':stat1,'samples':samples,'stat4':captures[0],'control':captures[1]})
raw={'profiles':profiles,'variants':variants}
(out/'skiprange-native.raw.json').write_text(json.dumps(raw,indent=2)+'\n')
(out/'skiprange-native.json').write_text(json.dumps(regression_capture(raw),separators=(',',':'))+'\n')
for a,b in zip(variants[0]['stat4'],variants[0]['control']):print(a['id'],a['eqp'],a['work'],'CONTROL',b['eqp'],b['work'])
