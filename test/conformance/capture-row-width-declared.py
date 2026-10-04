# Development-only pinned producer metadata oracle; not product runtime.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
L.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P]
L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),P]
L.sqlite3_step.argtypes=[P];L.sqlite3_finalize.argtypes=[P];L.sqlite3_close.argtypes=[P]
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+n);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
L.sqlite3_sourceid.restype=C.c_char_p
sql='CREATE TABLE q(id INTEGER PRIMARY KEY, a "CHAR(0x100)", b \'BLOB(0x7fffffff)\', c [CHAR(0x80000000)], d `CHAR(0x00010)`, e "CHAR(0x1\"\"f)", f BLOB(1000), g BLOB (1000), h CHAR(2147483648)); INSERT INTO q VALUES(1,\'é\',x\'ff00\',\'A\',\'B\',\'C\',x\'00\',x\'01\',\'D\'); CREATE INDEX qi ON q(a);'
out={'sourceId':L.sqlite3_sourceid().decode(),'ddl':sql,'variants':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-declared-'+enc.lower()+'.db')
 path.unlink(missing_ok=True);db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 assert L.sqlite3_exec(db,("PRAGMA encoding='"+enc+"';"+sql).encode(),None,None,None)==0
 st=P();assert L.sqlite3_prepare_v2(db,b'SELECT * FROM q',-1,C.byref(st),None)==0
 meta=[]
 for i in range(9):
  meta.append({k:(getattr(L,'sqlite3_column_'+n)(st,i) or b'').decode() for k,n in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]})
 assert L.sqlite3_step(st)==100;L.sqlite3_finalize(st);L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'metadata':meta})
pathlib.Path('test/conformance/cases/row-width-declared-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(out['sourceId']);print([(v['encoding'],v['metadata']) for v in out['variants']]);print(sum(pathlib.Path(v['fixture']).stat().st_size for v in out['variants']))
