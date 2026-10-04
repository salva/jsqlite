# Development-only pinned stat1 callback oracle. Writable construction only;
# product runtime opens immutable snapshots and never imports this script.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
L.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P]
L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),P]
L.sqlite3_step.argtypes=[P];L.sqlite3_finalize.argtypes=[P];L.sqlite3_close.argtypes=[P]
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
L.sqlite3_column_int64.argtypes=[P,C.c_int];L.sqlite3_column_int64.restype=C.c_longlong
L.sqlite3_sourceid.restype=C.c_char_p

for field in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+field);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
L.sqlite3_bind_double.argtypes=[P,C.c_int,C.c_double]
L.sqlite3_column_double.argtypes=[P,C.c_int];L.sqlite3_column_double.restype=C.c_double
L.sqlite3_column_type.argtypes=[P,C.c_int]
out={'sourceId':L.sqlite3_sourceid().decode(),'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-real-metadata-'+enc.lower()+'.db');path.unlink(missing_ok=True)
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 sql0="PRAGMA encoding='"+enc+"'; CREATE TABLE t(id INTEGER PRIMARY KEY,c REAL,tag CHAR(100) COLLATE NOCASE); CREATE INDEX tc ON t(c); INSERT INTO t VALUES(1,1.0,'é'),(2,2.5,'A'),(3,NULL,'n'); ANALYZE;"
 assert L.sqlite3_exec(db,sql0.encode(),None,None,None)==0
 sql='SELECT id,c,tag FROM t INDEXED BY tc WHERE c>=?1 ORDER BY c,id'
 st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 meta=[]
 for i in range(3):
  item={}
  for key,field in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
   b=getattr(L,'sqlite3_column_'+field)(st,i);item[key]=b.decode() if b else None
  meta.append(item)
 L.sqlite3_finalize(st)
 runs=[]
 for binding in [1.0,2.5,None]:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  if binding is not None:assert L.sqlite3_bind_double(st,1,binding)==0
  rows=[]
  while L.sqlite3_step(st)==100:rows.append([str(L.sqlite3_column_int64(st,0)),L.sqlite3_column_double(st,1),L.sqlite3_column_text(st,2).decode()])
  runs.append({'binding':binding,'rows':rows});L.sqlite3_finalize(st)
 L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sql':sql,'metadata':meta,'runs':runs})
pathlib.Path('test/conformance/cases/row-width-real-metadata-native.json').write_text(json.dumps(out,indent=2)+'\n');print(out)
