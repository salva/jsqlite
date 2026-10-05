#!/usr/bin/env python3
"""Native-first catalog SELECT snapshots on existing immutable digested images."""
import ctypes as C, hashlib, json, os, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root/'reference/sqlite/manifest.json').read_text())
lib = C.CDLL(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
P=C.c_void_p
lib.sqlite3_sourceid.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name,args,result in [('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('step',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('column_double',[P,C.c_int],C.c_double),('finalize',[P],C.c_int),('close',[P],C.c_int),('errmsg',[P],C.c_char_p)]:
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=result
for name in ['name','decltype','database_name','table_name','origin_name','text']:
 f=getattr(lib,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
# Additional persisted table/index/view/autoindex images are created only by
# the source-identity-checked pinned library, before public snapshots are taken.
lib.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P];lib.sqlite3_exec.restype=C.c_int
extra=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 path='test/fixtures/public-catalog/'+encoding.lower()+'.db'
 target=root/path;target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists(): target.unlink()
 db=P();assert lib.sqlite3_open_v2(str(target).encode(),C.byref(db),6,None)==0
 sql=f"PRAGMA encoding='{encoding}'; CREATE TABLE t(a TEXT UNIQUE,b INT); CREATE INDEX ix ON t(b); CREATE VIEW v AS SELECT a,b FROM t; INSERT INTO t VALUES('é',2);"
 assert lib.sqlite3_exec(db,sql.encode(),None,None,None)==0
 assert lib.sqlite3_close(db)==0
 extra.append(path)
queries=[
 'SELECT rowid,* FROM main.sqlite_schema ORDER BY rowid',
 'SELECT rowid,* FROM main.sqlite_master ORDER BY rowid',
 'SELECT s.type,s.name,s.tbl_name,s.rootpage,s.sql FROM main.sqlite_schema AS s ORDER BY s.rowid',
 'SELECT sqlite_master.name,sqlite_schema.rootpage FROM main.sqlite_schema ORDER BY rowid',
 'SELECT type,count(*) AS n FROM sqlite_schema GROUP BY type ORDER BY type',
 'SELECT name FROM sqlite_schema WHERE sql IS NULL ORDER BY name',
 'SELECT name FROM sqlite_schema UNION ALL SELECT name FROM sqlite_master ORDER BY name LIMIT 3',
 'SELECT sqlite_schema.* FROM sqlite_master ORDER BY rowid',
 'SELECT MAIN.SQLITE_SCHEMA.name FROM main.SQLITE_MASTER ORDER BY rowid',
 'SELECT name FROM (SELECT name FROM sqlite_schema) ORDER BY name LIMIT 2',
 'SELECT s.name,m.name FROM sqlite_schema AS s JOIN sqlite_master AS m ON s.rowid=m.rowid ORDER BY s.rowid',
 'SELECT sqlite_schema.name FROM sqlite_schema AS s',
 'SELECT missing FROM main.sqlite_schema',
 'SELECT * FROM other.sqlite_schema',
]
# R1 aggregate consumers: native paired spellings before caller repair.
for catalog in ['sqlite_schema', 'sqlite_master']:
 queries.extend([
  f'SELECT count(*),rootpage IN (SELECT rootpage FROM {catalog}) FROM sqlite_master',
  f'SELECT count(*),(SELECT rootpage FROM {catalog} LIMIT 1) FROM sqlite_master',
  f'SELECT count(*),(SELECT count(*) FROM {catalog}) FROM sqlite_master',
  f'SELECT sum(rootpage IN (SELECT rootpage FROM {catalog})) FROM sqlite_master',
  f'SELECT sum((SELECT rootpage FROM {catalog} LIMIT 1)) FROM sqlite_master',
  f'SELECT sum((SELECT count(*) FROM {catalog})) FROM sqlite_master',
  f'SELECT sum((SELECT missing FROM {catalog} LIMIT 1)) FROM sqlite_master',
 ])
current=json.loads((root/'test/fixtures/CURRENT.json').read_text())
prefix='test/fixtures/generations/'+current['generationId']+'/generated/'
files=[prefix+n for n in ['storage-p4096.db','storage-p4096-utf16le.db','storage-p4096-utf16be.db','encoding-utf8.db','encoding-utf16le.db','encoding-utf16be.db']]+['examples/browser/chinook.sqlite']+extra
output={'sourceId':manifest['sqliteSourceId'],'files':[]}
for path in files:
 db=P();assert lib.sqlite3_open_v2(str(root/path).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql in queries:
  stmt=P();rc=lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)
  case={'sql':sql}
  if rc:case['error']={'code':rc,'message':lib.sqlite3_errmsg(db).decode()}
  else:
   n=lib.sqlite3_column_count(stmt)
   def text(fn,i):
    v=getattr(lib,'sqlite3_column_'+fn)(stmt,i);return None if v is None else v.decode()
   case['columns']=[dict(zip(['name','declaredType','database','table','origin'],[text(fn,i) for fn in ['name','decltype','database_name','table_name','origin_name']])) for i in range(n)]
   rows=[]
   while (rc:=lib.sqlite3_step(stmt))==100:
    row=[]
    for i in range(n):
     t=lib.sqlite3_column_type(stmt,i)
     assert t in [1,2,3,5]
     row.append({'type':{1:'integer',2:'real',3:'text',5:'null'}[t],'value':str(lib.sqlite3_column_int64(stmt,i)) if t==1 else lib.sqlite3_column_double(stmt,i) if t==2 else text('text',i) if t==3 else None})
    rows.append(row)
   assert rc==101
   case['rows']=rows
  if stmt:lib.sqlite3_finalize(stmt)
  cases.append(case)
 lib.sqlite3_close(db)
 output['files'].append({'path':path,'sha256':hashlib.sha256((root/path).read_bytes()).hexdigest(),'cases':cases})
path=root/'test/schema/public-catalog-native.json'
path.write_text(json.dumps(output,indent=2)+'\n')
print('captured',len(files)*len(queries),'native cases;',path)
