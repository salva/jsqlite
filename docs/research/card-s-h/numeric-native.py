"""Pinned public C API numeric result oracle; invoke with library path."""
import ctypes as c,sys,json,hashlib,pathlib
p=pathlib.Path(sys.argv[1]);lib=c.CDLL(str(p))
lib.sqlite3_sourceid.restype=c.c_char_p
lib.sqlite3_open.argtypes=[c.c_char_p,c.POINTER(c.c_void_p)]
lib.sqlite3_prepare_v2.argtypes=[c.c_void_p,c.c_char_p,c.c_int,c.POINTER(c.c_void_p),c.c_void_p]
lib.sqlite3_step.argtypes=[c.c_void_p];lib.sqlite3_column_type.argtypes=[c.c_void_p,c.c_int]
lib.sqlite3_column_int64.argtypes=[c.c_void_p,c.c_int];lib.sqlite3_column_int64.restype=c.c_longlong
lib.sqlite3_column_double.argtypes=[c.c_void_p,c.c_int];lib.sqlite3_column_double.restype=c.c_double
lib.sqlite3_column_text.argtypes=[c.c_void_p,c.c_int];lib.sqlite3_column_text.restype=c.c_char_p
lib.sqlite3_finalize.argtypes=[c.c_void_p];lib.sqlite3_close.argtypes=[c.c_void_p]
print(json.dumps({'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceId':lib.sqlite3_sourceid().decode()}))
for fixture in sorted((pathlib.Path(__file__).parent/'skiprange-useful').glob('skiprange-*.db')):
 db=c.c_void_p();assert lib.sqlite3_open(str(fixture).encode(),c.byref(db))==0
 try:
  for lit in ['100','1_00','10.0','1_0.0','1e1_0','-1_00','+1_0.0','0x6_4']:
   st=c.c_void_p();sql=f'SELECT id,p FROM t WHERE b>{lit} AND c=1';assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(st),None)==0
   rows=[]
   try:
    while (rc:=lib.sqlite3_step(st))==100:rows.append([str(lib.sqlite3_column_int64(st,0)),lib.sqlite3_column_text(st,1).decode()])
    assert rc==101
   finally:lib.sqlite3_finalize(st)
   print(json.dumps({'fixture':fixture.name,'literal':lit,'count':len(rows),'typedRowsSHA256':hashlib.sha256(json.dumps(sorted(rows),separators=(',',':')).encode()).hexdigest()}))
 finally:lib.sqlite3_close(db)
