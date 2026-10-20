"""Pinned public C API discriminators; run with libsqlite3-oracle.so argument."""
import ctypes as C
import json
import pathlib
import sys
root=pathlib.Path(__file__).resolve().parents[3]
l=C.CDLL(sys.argv[1]); P=C.c_void_p
for name,args,result in [
 ('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),
 ('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),
 ('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),
 *[(name,[P,C.c_int],C.c_char_p) for name in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']]]:
 f=getattr(l,name);f.argtypes=args;f.restype=result
source=l.sqlite3_sourceid().decode()
assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
prefix='WITH RECURSIVE r(x) AS (VALUES(1),(1) UNION ALL SELECT x+1 FROM r WHERE x<2) '
cases=[]
for kind in ['RIGHT','FULL']:
 for on in ['r.x=t.x','0','NULL']:
  cases.append(prefix+f'SELECT r.x,t.x FROM r {kind} JOIN t ON {on} ORDER BY t.x,r.x')
 cases += [prefix+f'SELECT r.x,t.x FROM r {kind} JOIN t ON r.x=t.x WHERE r.x IS NULL ORDER BY t.x',
  'WITH RECURSIVE r(x) AS (SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM r WHERE x<2) '+f'SELECT r.x,t.x FROM r {kind} JOIN t ON r.x=t.x ORDER BY t.x',
  prefix+f'SELECT a.x,t.x,b.x FROM r a {kind} JOIN t ON a.x=t.x JOIN r b ON b.x=t.x ORDER BY t.x,a.x,b.x',
  prefix+f'SELECT a.x,t.x,b.x FROM r a {kind} JOIN t ON a.x=t.x JOIN r b ON b.x=1 ORDER BY t.x,a.x,b.x',
  'WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<3) '+f'SELECT r.x,t.x FROM r {kind} JOIN t ON r.x=t.x ORDER BY t.x',
  prefix+f'SELECT sum(t.x) FROM r {kind} JOIN t ON r.x=t.x']
results=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 d=P();assert l.sqlite3_open(str(root/f'test/fixtures/recursive-join/{encoding}-corrected.sqlite').encode(),C.byref(d))==0
 try:
  for sql in cases:
   s=P();assert l.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,sql
   try:
    n=l.sqlite3_column_count(s)
    metadata=[{key:(value.decode() if value else None) for key,value in [(key,getattr(l,fn)(s,i)) for key,fn in [('name','sqlite3_column_name'),('declaredType','sqlite3_column_decltype'),('database','sqlite3_column_database_name'),('table','sqlite3_column_table_name'),('origin','sqlite3_column_origin_name')]]} for i in range(n)]
    passes=[]
    for _ in range(2):
     rows=[]
     while True:
      rc=l.sqlite3_step(s)
      if rc==101:break
      assert rc==100,(rc,sql)
      row=[]
      for i in range(n):
       t=l.sqlite3_column_type(s,i);assert t in [1,5],t
       row.append({'type':'null'} if t==5 else {'type':'integer','value':str(l.sqlite3_column_int64(s,i))})
      rows.append(row)
     passes.append(rows);assert l.sqlite3_reset(s)==0
    assert passes[0]==passes[1]
    results.append(dict(encoding=encoding,sql=sql,metadata=metadata,rows=passes[0]))
   finally:assert l.sqlite3_finalize(s)==0
 finally:assert l.sqlite3_close(d)==0
print(json.dumps(dict(sourceId=source,cases=results),indent=2))
