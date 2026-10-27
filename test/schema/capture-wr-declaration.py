import ctypes as C, json, os, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
lib=C.CDLL(os.environ['WR_ORACLE'])
lib.sqlite3_sourceid.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
lib.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]
lib.sqlite3_exec.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_char_p)]
lib.sqlite3_close.argtypes=[C.c_void_p]
lib.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.c_void_p]
for fn in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name','sqlite3_errmsg']:
 getattr(lib,fn).restype=C.c_char_p
for fn in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name','sqlite3_column_text','sqlite3_column_blob','sqlite3_column_type','sqlite3_column_bytes']:
 getattr(lib,fn).argtypes=[C.c_void_p,C.c_int]
lib.sqlite3_column_text.restype=C.c_void_p;lib.sqlite3_column_blob.restype=C.c_void_p
lib.sqlite3_column_int64.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_int64.restype=C.c_longlong
lib.sqlite3_column_double.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_double.restype=C.c_double
for fn in ['sqlite3_step','sqlite3_finalize','sqlite3_column_count','sqlite3_errmsg']:
 getattr(lib,fn).argtypes=[C.c_void_p]
def typed(db,sql):
 stmt=C.c_void_p();rc=lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None)
 if rc:return {'error':{'code':rc,'message':lib.sqlite3_errmsg(db).decode()}}
 try:
  columns=[]
  for i in range(lib.sqlite3_column_count(stmt)):
   columns.append({key:(value.decode() if value else None) for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')] for value in [getattr(lib,'sqlite3_column_'+fn)(stmt,i)]})
  rows=[]
  while True:
   rc=lib.sqlite3_step(stmt)
   if rc!=100:break
   row=[]
   for i in range(len(columns)):
    t=lib.sqlite3_column_type(stmt,i);kind={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t]
    if t==1:value=str(lib.sqlite3_column_int64(stmt,i))
    elif t==2:value=lib.sqlite3_column_double(stmt,i)
    elif t in [3,4]:
     p=getattr(lib,'sqlite3_column_'+('text' if t==3 else 'blob'))(stmt,i);b=C.string_at(p,lib.sqlite3_column_bytes(stmt,i));value=b.decode() if t==3 else b.hex()
    else:value=None
    row.append({'type':kind,'value':value})
   rows.append(row)
  assert rc==101,rc
  return {'columns':columns,'rows':rows}
 finally:lib.sqlite3_finalize(stmt)
callback=C.CFUNCTYPE(C.c_int,C.c_void_p,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_char_p))
folder=pathlib.Path(os.environ['WR_FIXTURES']);folder.mkdir(parents=True,exist_ok=True)
cases=[
 ('samecollation','a TEXT, b TEXT, UNIQUE(a DESC), PRIMARY KEY(a ASC)'),
 ('merged','a TEXT UNIQUE, b TEXT, PRIMARY KEY(a DESC)'),
 ('collated','a TEXT, b TEXT, UNIQUE(a COLLATE nocase), PRIMARY KEY(a COLLATE binary DESC)'),
 ('delayed','a INTEGER PRIMARY KEY, b TEXT UNIQUE'),
 ('repeated','a TEXT, b TEXT, PRIMARY KEY(a,a,b)'),
 ('replace','a TEXT UNIQUE ON CONFLICT REPLACE, b TEXT, PRIMARY KEY(b), UNIQUE(a) ON CONFLICT REPLACE'),
]
receipt={'sourceId':lib.sqlite3_sourceid().decode(),'files':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=folder/(enc+'.db')
 if path.exists():path.unlink()
 db=C.c_void_p();assert lib.sqlite3_open(str(path).encode(),C.byref(db))==0
 def query(sql):
  rows=[]
  @callback
  def cb(_,n,vals,names):
   rows.append([vals[i].decode() if vals[i] is not None else None for i in range(n)]);return 0
  err=C.c_char_p();rc=lib.sqlite3_exec(db,sql.encode(),C.cast(cb,C.c_void_p),None,C.byref(err))
  if rc:raise RuntimeError((rc,err.value,sql))
  return rows
 query(f"PRAGMA encoding='{enc}';")
 for name,definition in cases:
  query(f"CREATE TABLE {name}({definition}) WITHOUT ROWID; INSERT INTO {name} VALUES('2','z'),('1','y'); CREATE INDEX {name}_explicit ON {name}(b DESC);")
 tables=[]
 for name,_ in cases:
  indexes=query(f'PRAGMA index_list({name})')
  tables.append({'name':name,'indexes':indexes,'xinfo':{i[1]:query(f'PRAGMA index_xinfo({i[1]})') for i in indexes},'rows':query(f'SELECT a,b FROM {name} ORDER BY a')})
 receipt['files'].append({'file':path.name,'tables':tables,'reads':[{'sql':sql,**typed(db,sql)} for sql in [*[f'SELECT a,b FROM {name} ORDER BY a' for name,_ in cases],"SELECT a,b,7 AS i,7.0 AS r,NULL AS n,x'0080ff' AS bytes FROM merged WHERE a='1'",'SELECT a,b FROM delayed INDEXED BY delayed_explicit WHERE b=\'y\'']]})
 lib.sqlite3_close(db)
 # Native first: persist invalid declaration/root variants, then reopen so
 # sqlite3InitCallback consumes them rather than the writer's cached schema.
 controls=[
  ('missing-pk-type',"UPDATE sqlite_schema SET sql='CREATE TABLE merged(a BAD, b TEXT, PRIMARY KEY(absent)) STRICT, WITHOUT ROWID' WHERE name='merged'"),
  ('conflict-invalid',"UPDATE sqlite_schema SET sql='CREATE TABLE merged(a TEXT UNIQUE ON CONFLICT ABORT, b TEXT, PRIMARY KEY(a) ON CONFLICT REPLACE) WITHOUT ROWID' WHERE name='merged'"),
  ('orphan',"UPDATE sqlite_schema SET tbl_name='absent' WHERE name='merged_explicit'"),
  ('corrupt-root',"UPDATE sqlite_schema SET rootpage=999999 WHERE name='merged_explicit'"),
 ]
 for label,mutation in controls:
  import shutil
  target=folder/(enc+'-'+label+'.db');shutil.copyfile(path,target)
  assert lib.sqlite3_open(str(target).encode(),C.byref(db))==0
  query('PRAGMA writable_schema=ON');query(mutation);lib.sqlite3_close(db)
  assert lib.sqlite3_open(str(target).encode(),C.byref(db))==0
  receipt.setdefault('controls',[]).append({'file':target.name,'sql':'SELECT a FROM merged','result':typed(db,'SELECT a FROM merged')})
  lib.sqlite3_close(db)
(folder/'native.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'sourceId':receipt['sourceId'],'files':len(receipt['files']),'tables':len(cases)}))
