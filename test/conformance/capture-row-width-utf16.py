# Development-only pinned sqlite3_column_text byte oracle for callback conversion.
import ctypes as C,os,json,pathlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
L.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P]
L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),P]
L.sqlite3_step.argtypes=[P];L.sqlite3_finalize.argtypes=[P];L.sqlite3_close.argtypes=[P]
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=P
L.sqlite3_column_bytes.argtypes=[P,C.c_int];L.sqlite3_sourceid.restype=C.c_char_p
out={'sourceId':L.sqlite3_sourceid().decode(),'cases':[]}
for enc,codec in [('UTF-16le','utf-16le'),('UTF-16be','utf-16be')]:
 db=P();assert L.sqlite3_open_v2(b':memory:',C.byref(db),6,None)==0
 assert L.sqlite3_exec(db,('PRAGMA encoding="'+enc+'";CREATE TABLE t(v);').encode(),None,None,None)==0
 for units,odd in [([0xd800],False),([0xdc00],False),([0xd800,0x41],False),([0xdc00,0x41],False),([0x41],True),([0xd800,0xdc00],False)]:
  raw=b''.join(u.to_bytes(2,'little' if enc.endswith('le') else 'big') for u in units)+(b'\xff' if odd else b'')
  sql="DELETE FROM t;INSERT INTO t VALUES(x'"+raw.hex()+"');"
  assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0
  st=P();assert L.sqlite3_prepare_v2(db,b'SELECT v FROM t',-1,C.byref(st),None)==0;assert L.sqlite3_step(st)==100
  ptr=L.sqlite3_column_text(st,0);n=L.sqlite3_column_bytes(st,0);text=C.string_at(ptr,n)
  out['cases'].append({'encoding':enc.lower(),'input':raw.hex(),'output':text.hex()});L.sqlite3_finalize(st)
 L.sqlite3_close(db)
pathlib.Path('test/conformance/cases/row-width-utf16-native.json').write_text(json.dumps(out,indent=2)+'\n');print(out)
