#!/usr/bin/env python3
"""Pinned native adjudication of the three historical ORDER/LIMIT assertions.

Development only; no TypeScript credit is inferred from this capture.
"""
import ctypes as C, importlib.util, json, pathlib, sys, hashlib
root=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-subquery-view.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);identity=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==identity['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
queries=[
 'SELECT x FROM t1 UNION ALL SELECT x FROM t1 ORDER BY 1 LIMIT 1',
 'SELECT x FROM (SELECT x FROM t1) ORDER BY x LIMIT 1',
 'SELECT (SELECT x FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 1',
 'SELECT (SELECT x FROM t1 WHERE x<0 LIMIT 1) AS x ORDER BY x LIMIT 1',
 'SELECT (SELECT NULL FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 1',
 'SELECT (SELECT x FROM t1 LIMIT 0) AS x ORDER BY x LIMIT 1',
 'SELECT (SELECT x FROM t1 ORDER BY x LIMIT 1 OFFSET 1) AS x ORDER BY x LIMIT 1',
 'SELECT (SELECT x FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 0',
 'SELECT (SELECT x FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 1 OFFSET 1',
 "SELECT (SELECT x FROM t1 LIMIT 'x') AS x ORDER BY x LIMIT 1",
]
out=[]
for enc in ['utf8','utf16le','utf16be']:
 p=root/(f'test/fixtures/generations/{g}/generated/expr-relational.db' if enc=='utf8' else f'test/conformance/fixtures/order-limit-relational-{enc}.db')
 db=m.P();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 for sql in queries:
  s=m.P();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None);assert rc==0
  n=d.sqlite3_column_count(s);fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
  o={'encoding':enc,'sql':sql,'fixtureSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'prepareCode':rc,'columns':[dict(zip(['name','declaredType','database','table','origin'],[m.text(fn(s,i)) for fn in fns])) for i in range(n)],'first':m.run(d,db,s,n)}
  o['resetCode']=d.sqlite3_reset(s);o['afterReset']=m.run(d,db,s,n);o['finalizeCode']=d.sqlite3_finalize(s);out.append(o)
 d.sqlite3_close(db)
actual={'sourceId':d.sqlite3_sourceid().decode(),'cases':out}
capture=root/'test/conformance/cases/order-limit-subquery-native.json'
if '--write' in sys.argv:capture.write_text(json.dumps(actual,indent=2)+'\n')
else:assert actual==json.loads(capture.read_text())
print('ORDER/LIMIT subquery oracle: pinned source ID; 30 native assertions, exact metadata/typed rows/error phase/reset/finalize; no TS credit inferred')
