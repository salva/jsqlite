#!/usr/bin/env python3
"""Pinned native-first reached generated purity matrix; development only."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p)]+[(n,[P,C.c_int],C.c_char_p) for n in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']]:
 f=getattr(L,n);f.argtypes=a;f.restype=r
root=pathlib.Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True)
cases=[
 'SELECT g FROM t', 'SELECT t.g FROM t JOIN literal ON 1', 'SELECT g FROM (SELECT g FROM t)',
 'SELECT h FROM nested', 'SELECT g FROM omitted', 'SELECT g FROM subsec', 'SELECT g FROM zone',
 'SELECT g FROM literal','SELECT h FROM nested_literal','SELECT g FROM stored',
 "SELECT CASE WHEN 1 THEN 'ok' ELSE g END AS chosen FROM t",'SELECT g FROM literal WHERE 0',
 'SELECT g FROM literal UNION ALL SELECT g FROM t',
 'SELECT (SELECT g FROM t) AS child',
 'SELECT g FROM nullfmt', 'SELECT g FROM nullzone', 'SELECT g FROM nullsubsec',
 'SELECT g FROM fmtzone',
]
receipts=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/f'{encoding}.db';p.unlink(missing_ok=True);db=P();assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
 def execute(sql):
  e=C.c_char_p();rc=L.sqlite3_exec(db,sql.encode(),None,None,C.byref(e));assert rc==0,(rc,e.value)
 execute(f"PRAGMA encoding='{encoding}'")
 # STORED is a real physical column: changing its expression must not recompute it.
 definitions={
 'nullfmt':"CREATE TABLE nullfmt(a TEXT,g TEXT AS (strftime(NULL,a)) VIRTUAL)",
 'nullzone':"CREATE TABLE nullzone(a TEXT,g TEXT AS (strftime(NULL,'2000-01-01','localtime')) VIRTUAL)",
 'nullsubsec':"CREATE TABLE nullsubsec(a TEXT,g TEXT AS (strftime(NULL,'subsec')) VIRTUAL)",
 'fmtzone':"CREATE TABLE fmtzone(a TEXT,g TEXT AS (strftime('%Y','2000-01-01','localtime')) VIRTUAL)",
 't':"CREATE TABLE t(a TEXT,g TEXT AS (datetime(a)) VIRTUAL)",
 'literal':"CREATE TABLE literal(a TEXT,g TEXT AS (datetime('2000-01-01')) VIRTUAL)",
 'nested':"CREATE TABLE nested(a TEXT,g TEXT AS (datetime(a)) VIRTUAL,h TEXT AS (upper(g)) VIRTUAL)",
 'nested_literal':"CREATE TABLE nested_literal(a TEXT,g TEXT AS (datetime('2000-01-01')) VIRTUAL,h TEXT AS (upper(g)) VIRTUAL)",
 'omitted':"CREATE TABLE omitted(a TEXT,g TEXT AS (datetime()) VIRTUAL)",
 'subsec':"CREATE TABLE subsec(a TEXT,g TEXT AS (datetime('subsec')) VIRTUAL)",
 'zone':"CREATE TABLE zone(a TEXT,g TEXT AS (datetime('2000-01-01','utc')) VIRTUAL)",
 }
 for name in definitions:execute(f"CREATE TABLE {name}(a TEXT);INSERT INTO {name} VALUES('now')")
 execute("CREATE TABLE stored(a TEXT,g TEXT AS (a) STORED);INSERT INTO stored(a) VALUES('persisted');PRAGMA writable_schema=ON")
 definitions['stored']="CREATE TABLE stored(a TEXT,g TEXT AS (datetime(a)) STORED)"
 for name,ddl in definitions.items():execute("UPDATE sqlite_schema SET sql='"+ddl.replace("'","''")+"' WHERE name='"+name+"'")
 execute('PRAGMA writable_schema=OFF');L.sqlite3_close(db);assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
 for sql in cases:
  s=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None);assert rc==0,(sql,rc,L.sqlite3_errmsg(db))
  metadata=[]
  for i in range(L.sqlite3_column_count(s)):
   metadata.append({key:(getattr(L,n)(s,i).decode() if getattr(L,n)(s,i) else None) for key,n in [('name','sqlite3_column_name'),('declaredType','sqlite3_column_decltype'),('databaseName','sqlite3_column_database_name'),('tableName','sqlite3_column_table_name'),('originName','sqlite3_column_origin_name')]})
  rows=[]
  while True:
   rc=L.sqlite3_step(s)
   if rc!=100:break
   rows.append([{'type':L.sqlite3_column_type(s,i),'value':L.sqlite3_column_text(s,i).decode() if L.sqlite3_column_type(s,i)!=5 else None} for i in range(len(metadata))])
  error=L.sqlite3_errmsg(db).decode() if rc!=101 else None
  receipts.append(dict(encoding=encoding,sql=sql,metadata=metadata,rows=rows,rc=rc,error=error));L.sqlite3_finalize(s)
 L.sqlite3_close(db)
result={'sourceId':L.sqlite3_sourceid().decode(),'observations':len(receipts),'tsCredit':0,'cases':receipts}
(root/'native.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
