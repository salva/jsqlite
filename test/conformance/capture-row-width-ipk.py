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
out={'sourceId':L.sqlite3_sourceid().decode(),'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-ipk-'+enc.lower()+'.db');path.unlink(missing_ok=True)
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 sql="PRAGMA encoding='"+enc+"'; CREATE TABLE d(id INTEGER PRIMARY KEY DESC,a CHAR(100)); CREATE TABLE t(id INTEGER,a CHAR(100),PRIMARY KEY(id DESC)); INSERT INTO d VALUES(7,'D'); INSERT INTO t VALUES(7,'T'); ANALYZE;"
 assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0
 def rows(sql):
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0;r=[]
  while L.sqlite3_step(st)==100:r.append([None if L.sqlite3_column_text(st,i)==None else L.sqlite3_column_text(st,i).decode() for i in range(3)])
  L.sqlite3_finalize(st);return r
 expected={name:rows('SELECT rowid,id,a FROM '+name) for name in ['d','t']}
 stat=rows('SELECT tbl,idx,stat FROM sqlite_stat1')
 L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'stat':stat,'expected':expected})
pathlib.Path('test/conformance/cases/row-width-ipk-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(out)
