# Development-only readonly pinned-oracle capture; no product runtime import.
import ctypes as C, json, os, hashlib, pathlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
L.sqlite3_step.argtypes=[P]; L.sqlite3_finalize.argtypes=[P]; L.sqlite3_close.argtypes=[P]
L.sqlite3_column_text.argtypes=[P,C.c_int]; L.sqlite3_column_text.restype=C.c_char_p
L.sqlite3_column_int64.argtypes=[P,C.c_int]; L.sqlite3_column_int64.restype=C.c_longlong
L.sqlite3_stmt_status.argtypes=[P,C.c_int,C.c_int]
L.sqlite3_sourceid.restype=C.c_char_p
out={'sourceId':L.sqlite3_sourceid().decode(),'cases':[]}
for v in json.load(open('test/conformance/cases/stage3-advanced-index.json'))['variants']:
 fixture=v['fixture']['path']; db=P(); assert L.sqlite3_open_v2(fixture.encode(),C.byref(db),1,None)==0
 for hint in ['INDEXED BY m_abc','NOT INDEXED']:
  sql=f'SELECT y.b FROM m x JOIN m y {hint} ON y.a=x.a WHERE x.id=2 AND y.b>=1 AND y.b<=3 ORDER BY y.b DESC'
  def prep(sql):
   st=P(); rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None); assert rc==0,rc; return st
  st=prep('EXPLAIN QUERY PLAN '+sql); eqp=[]
  while L.sqlite3_step(st)==100:eqp.append(L.sqlite3_column_text(st,3).decode())
  L.sqlite3_finalize(st); st=prep(sql); rows=[]
  while L.sqlite3_step(st)==100:rows.append(L.sqlite3_column_int64(st,0))
  out['cases'].append({'encoding':v['id'],'fixture':{'path':fixture,'sha256':hashlib.sha256(pathlib.Path(fixture).read_bytes()).hexdigest()},'sql':sql,'eqp':eqp,'integerRows':rows,'sortCount':L.sqlite3_stmt_status(st,2,0)})
  L.sqlite3_finalize(st)
 L.sqlite3_close(db)
print(json.dumps(out,indent=2))
