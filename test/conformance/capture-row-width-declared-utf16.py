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
sql="CREATE TABLE q(c CHAR(16)); INSERT INTO q VALUES('é'); CREATE INDEX qi ON q(c);"
out={'sourceId':L.sqlite3_sourceid().decode(),'ddl':sql,'variants':[]}
for enc in ['UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-declared-utf16-'+enc.lower()+'.db')
 path.unlink(missing_ok=True);db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 assert L.sqlite3_exec(db,("PRAGMA encoding='"+enc+"';"+sql).encode(),None,None,None)==0
 codec='utf-16le' if enc=='UTF-16le' else 'utf-16be'
 # High surrogate consumes next non-low unit as pinned UTF16 translate does.
 raw='CREATE TABLE q(c "'.encode(codec)+'\ud800XCHAR(0x10)")'.encode(codec,errors='surrogatepass')
 assert L.sqlite3_exec(db,("PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql=CAST(x'"+raw.hex()+"' AS TEXT) WHERE name='q'; PRAGMA writable_schema=RESET;").encode(),None,None,None)==0
 st=P();rc=L.sqlite3_prepare_v2(db,b'SELECT * FROM q',-1,C.byref(st),None)
 assert rc==0,rc
 metadata={k:(getattr(L,'sqlite3_column_'+n)(st,0) or b'').hex() for k,n in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]}
 assert L.sqlite3_step(st)==100
 rowHex=(L.sqlite3_column_text(st,0) or b'').hex()
 L.sqlite3_finalize(st)
 L.sqlite3_close(db)
 out['variants'].append({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'prepareCode':rc,'metadataUtf8Hex':metadata,'rowUtf8Hex':rowHex})
pathlib.Path('test/conformance/cases/row-width-declared-utf16-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(out['sourceId']);print([(v['encoding'],v['prepareCode']) for v in out['variants']]);print(sum(pathlib.Path(v['fixture']).stat().st_size for v in out['variants']))
