#!/usr/bin/env python3
"""Native development capture: join8-3010..3040 read-only ports, setup adapted."""
import ctypes as C,hashlib,importlib.util,json,os,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
guard_spec=importlib.util.spec_from_file_location('repeated_inputs',root/'test/conformance/repeated-capture-inputs.py')
guard=importlib.util.module_from_spec(guard_spec);guard_spec.loader.exec_module(guard)
guard.preflight(root,['cases/repeated-upstream-join8.json', 'fixtures/repeated-upstream-join8.db'])
s=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
m=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
setup=[]
for i,col in enumerate('abcdefgh',1):
 setup += [f'CREATE TABLE t{i}(id INTEGER PRIMARY KEY,{col} INT);',f'INSERT INTO t{i} VALUES '+','.join(f'({v},1)' for v in range(1,257) if v&(1<<(i-1)))+';']
body='SELECT id,h,g,f,e,d,c,b,a FROM t1 '+' '.join(f'NATURAL FULL JOIN t{i}' for i in range(2,9))
expr='128*h+64*g+32*f+16*e+8*d+4*c+2*b+a'
# UPDATE t9 null->0 becomes a read-only projection for immutable runtime input.
normalized='SELECT id,'+','.join(f'coalesce({c},0) AS {c}' for c in 'hgfedcba')+' FROM ('+body+')'
cases=[('join8-3010',f'SELECT count(*) FROM ({body})',[[{'type':'integer','value':'255'}]]),('join8-3020',f'SELECT id,count(*) FROM ({body}) GROUP BY id HAVING count(*)!=1',[]),('join8-3030',f'SELECT count(*) FROM ({normalized}) WHERE id={expr}',[[{'type':'integer','value':'255'}]]),('join8-3040',f'SELECT * FROM ({normalized}) WHERE id<>{expr}',[])]
path=root/'test/conformance/fixtures/repeated-upstream-join8.db';assert not path.exists();db=h.P();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
try:
 for sql in setup:assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0
finally:assert d.sqlite3_close(db)==0
out={'sourceId':m['sqliteSourceId'],'setup':setup,'fixtureSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'cases':[],'adaptations':['generate_series(1,256) bit filters -> identical literal rows','CREATE TABLE t9 AS -> derived read-only SELECT','3030 UPDATE null columns to0 -> coalesce projection;3040 consumes same normalized relation'],'upstreamHash':hashlib.sha256((root/'reference/sqlite/sqlite-src-3530400/test/join8.test').read_bytes()).hexdigest()}
for id,sql,want in cases:
 c={'id':id,'sql':sql,'setup':'s'};native=h.capture(d,{'setups':{'s':setup}},c);assert native['first']['rows']==want,(id,native);out['cases'].append(dict(id=id,sql=sql,native=native,classification='upstream assertion port with disclosed setup/query adaptations'))
(root/'test/conformance/cases/repeated-upstream-join8.json').write_text(json.dumps(out,indent=2)+'\n');print('native join8-3010/3020/3030/3040 adapted assertions:4/4')
