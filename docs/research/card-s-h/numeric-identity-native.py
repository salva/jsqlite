"""Independent pinned public prepare/step controls for resolver numeric identity."""
import ctypes as c, hashlib, json, pathlib, sys
p=pathlib.Path(sys.argv[1]); lib=c.CDLL(str(p))
lib.sqlite3_sourceid.restype=c.c_char_p
lib.sqlite3_open.argtypes=[c.c_char_p,c.POINTER(c.c_void_p)]
lib.sqlite3_prepare_v2.argtypes=[c.c_void_p,c.c_char_p,c.c_int,c.POINTER(c.c_void_p),c.c_void_p]
lib.sqlite3_step.argtypes=[c.c_void_p]
lib.sqlite3_column_int64.argtypes=[c.c_void_p,c.c_int];lib.sqlite3_column_int64.restype=c.c_longlong
lib.sqlite3_finalize.argtypes=[c.c_void_p];lib.sqlite3_close.argtypes=[c.c_void_p]
db=c.c_void_p(); assert lib.sqlite3_open(b':memory:',c.byref(db))==0
print(json.dumps({'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceId':lib.sqlite3_sourceid().decode()}))
def run(sql):
 st=c.c_void_p(); rc=lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(st),None); rows=[]
 if rc==0:
  try:
   while (rc:=lib.sqlite3_step(st))==100: rows.append(lib.sqlite3_column_int64(st,0))
  finally: lib.sqlite3_finalize(st)
 return rc,rows
try:
 assert run('CREATE TABLE a(x INTEGER)')[0]==101
 assert run('INSERT INTO a VALUES(1)')[0]==101
 for a,b,equal in [('-1_0','-10',True),('1_0','10',True),('0x1_0','16',True),('1_0.0','10.0',True),('1e1_0','1e10',True),('1_0.0','10',False),('1_0.0','1e1',False),('1_0','11',False),('-1_0','+10',False),("'1_0'","'10'",False)]:
  sql=f'SELECT a.x+({a}) FROM a UNION ALL SELECT a.x FROM a ORDER BY x+({b})'
  rc,rows=run(sql);assert (rc==101)==equal,(sql,rc)
  print(json.dumps({'sql':sql,'rc':rc,'integerRows':rows}))
finally: lib.sqlite3_close(db)
