"""Independent native in-memory Db filename/temp-residency comparison."""
import ctypes as C, json, pathlib, os
lib=C.CDLL(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
lib.sqlite3_sourceid.restype=C.c_char_p
root=pathlib.Path(__file__).resolve().parents[3]
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
lib.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]
lib.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.c_void_p]
lib.sqlite3_column_text.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_text.restype=C.c_char_p
for name in ['sqlite3_step','sqlite3_finalize','sqlite3_close']:getattr(lib,name).argtypes=[C.c_void_p]
db=C.c_void_p();assert lib.sqlite3_open(b':memory:',C.byref(db))==0
result=[]
for sql in ['PRAGMA database_list','PRAGMA temp.no_such_read_metadata','PRAGMA database_list']:
 s=C.c_void_p();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None)==0
 rows=[]
 while True:
  rc=lib.sqlite3_step(s)
  if rc==101:break
  assert rc==100
  rows.append([lib.sqlite3_column_text(s,i).decode() for i in range(3)])
 assert lib.sqlite3_finalize(s)==0
 result.append({'sql':sql,'rows':rows})
assert result[0]['rows']==[['0','main','']]
assert result[2]['rows']==[['0','main',''],['1','temp','']]
assert lib.sqlite3_close(db)==0
(root/'docs/research/card-e-n-pragma-red/memory-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('Pinned memory Db filename and explicit-temp residency assertions pass.')
