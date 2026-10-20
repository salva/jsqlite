"""Reuse the source-ID-checked C API recorder for the existing WR fixture family."""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[3]
recorder = (root/'docs/research/recursive-join/right-full-native.py').read_text()
start = recorder.index('cases=[')
end = recorder.index('results=[]', start)
cases = []
for kind in ['RIGHT', 'FULL']:
 for on in ['a.a=b.a AND a.b=b.b', 'a.a=b.a', '0', 'NULL', 'a.b=1', 'b.b=1']:
  base = f' FROM w a {kind} JOIN w b ON {on}'
  cases.extend([
   'SELECT a.a,a.b,b.a,b.b'+base+' ORDER BY b.a,b.b,a.a,a.b',
   'SELECT a.*,b.*'+base+' WHERE a.a IS NULL ORDER BY b.a,b.b',
   'SELECT a.a,b.a'+base+' WHERE a.b=1 ORDER BY b.a,a.a',
  ])
 cases.extend([
  f'SELECT * FROM w a {kind} JOIN w b USING(a,b) ORDER BY a,b',
  f'SELECT * FROM w a NATURAL {kind} JOIN w b ORDER BY a,b',
  f'SELECT DISTINCT a.a,b.a FROM w a {kind} JOIN w b ON 0 ORDER BY b.a,a.a LIMIT 2 OFFSET 1',
  f'SELECT a.a,b.a,c.a FROM w a {kind} JOIN w b ON a.a=b.a AND a.b=1 {kind} JOIN w c ON b.a=c.a AND b.b=1 ORDER BY c.a,b.a,a.a',
 ])
recorder = recorder[:start] + 'cases='+repr(cases)+'\n' + recorder[end:]
recorder = recorder.replace("['UTF-8','UTF-16le','UTF-16be']", "['utf-8','utf-16le','utf-16be']")
recorder = recorder.replace("test/fixtures/recursive-join/{encoding}-corrected.sqlite", "test/conformance/fixtures/row-width-wr-duplicate-{encoding}.db")
# Keep the canonical script location for its project-root calculation.
# Additional persistent fixtures exercise key identity beyond the two-row width
# discriminator. Generate with the same pinned C API, not a host sqlite module.
recorder = recorder.replace("results=[]", """
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 path=root/f'test/conformance/fixtures/wr-right-full-{encoding.lower()}.db'
 path.unlink(missing_ok=True)
 d=P();assert l.sqlite3_open(str(path).encode(),C.byref(d))==0
 setup=[f'PRAGMA encoding=\"{encoding}\"',
  'CREATE TABLE w(a TEXT,b,c,PRIMARY KEY(a COLLATE RTRIM DESC,b,c)) WITHOUT ROWID',
  \"INSERT INTO w VALUES('x',1,1),('x ',1,2),('x',2,3),('z',9223372036854775807,4),('',1.5,5),('b',x'00ff',6)\",
  'CREATE TABLE r(a TEXT,b,c)',
  \"INSERT INTO r VALUES('x',1,1),('x',1,1),('missing',9,9),(NULL,NULL,NULL)\",
  'CREATE TABLE e(a TEXT,b,c,PRIMARY KEY(a,b,c)) WITHOUT ROWID']
 for sql in setup:
  s=P();assert l.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,sql
  assert l.sqlite3_step(s)==101,sql
  assert l.sqlite3_finalize(s)==0
 assert l.sqlite3_close(d)==0
results=[]
""")
# Execute the original width matrix and the wider mixed-storage matrix using
# separate records; fixture paths are explicit in the resulting evidence.
recorder = recorder.replace("for encoding in ['utf-8','utf-16le','utf-16be']:", "for variant in ['width','mixed']:\n for encoding in ['utf-8','utf-16le','utf-16be']:")
# Re-indent the original capture loop under the variant loop.
start_loop = recorder.index(" d=P();assert l.sqlite3_open(str(root/f'test/conformance/fixtures/row-width")
end_loop = recorder.index('print(json.dumps', start_loop)
body = recorder[start_loop:end_loop]
body = body.replace("root/f'test/conformance/fixtures/row-width-wr-duplicate-{encoding}.db'", "root/(f'test/conformance/fixtures/row-width-wr-duplicate-{encoding}.db' if variant=='width' else f'test/conformance/fixtures/wr-right-full-{encoding}.db')")
body = body.replace('for sql in cases:', 'for sql in (cases if variant==\'width\' else mixed):')
body = body.replace('dict(encoding=encoding,sql=sql', 'dict(variant=variant,encoding=encoding,sql=sql')
recorder = recorder[:start_loop] + ''.join(' '+line+'\n' for line in body.splitlines()) + recorder[end_loop:]
mixed=[]
for kind in ['RIGHT','FULL']:
 for left,right in [('r','w'),('w','r'),('e','w'),('w','e'),('e','e'),('w','w')]:
  for on in ['a.a=b.a AND a.b=b.b','a.a=b.a','0','NULL']:
   mixed.append(f'SELECT a.a,a.b,a.c,b.a,b.b,b.c FROM {left} a {kind} JOIN {right} b ON {on} ORDER BY b.c,a.c,b.a,a.a,b.b,a.b')
  mixed.append(f'SELECT a.*,b.* FROM {left} a {kind} JOIN {right} b ON a.a=b.a WHERE a.c IS NULL ORDER BY b.c,a.c')
 mixed.append(f'SELECT a.c,b.c,c.c FROM r a LEFT JOIN w b ON a.a=b.a {kind} JOIN w c ON b.b=c.b ORDER BY c.c,b.c,a.c')
recorder=recorder.replace('results=[]', 'mixed='+repr(mixed)+'\nresults=[]')
exec(compile(recorder, str(root/'docs/research/recursive-join/right-full-native.py'), 'exec'),
     {'__file__': str(root/'docs/research/recursive-join/right-full-native.py'), '__name__': '__main__'})
