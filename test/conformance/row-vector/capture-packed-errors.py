#!/usr/bin/env python3
"""Native-first error schedules; explicit pinned metadata-enabled library only."""
import ctypes as C, hashlib, json, pathlib, sys
root = pathlib.Path.cwd()
lib = pathlib.Path(sys.argv[1]).resolve()
L = C.CDLL(str(lib)); P = C.c_void_p
for name, args, result in [
 ('sqlite3_sourceid', [], C.c_char_p), ('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),
 ('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),
 ('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),
 ('sqlite3_errmsg',[P],C.c_char_p),('sqlite3_extended_errcode',[P],C.c_int)]:
 f=getattr(L,name);f.argtypes=args;f.restype=result
spec=json.loads((root/'test/conformance/row-vector/spec.json').read_text())
assert L.sqlite3_sourceid().decode()==spec['sourceId']
queries_path=root/'test/conformance/row-vector/packed-errors-queries.json'
out={'sourceId':spec['sourceId'],'librarySha256':hashlib.sha256(lib.read_bytes()).hexdigest(),
     'queriesSha256':hashlib.sha256(queries_path.read_bytes()).hexdigest(),'encodings':{}}
def error(db,rc):
 return dict(code=rc&255,extendedCode=L.sqlite3_extended_errcode(db),message=L.sqlite3_errmsg(db).decode())
for enc in ['utf8','utf16le','utf16be']:
 fixture=root/f'test/fixtures/row-vector/pairs-{enc}.db'
 db=P();assert L.sqlite3_open(str(fixture).encode(),C.byref(db))==0
 cases=[]
 for sql in json.loads(queries_path.read_text()):
  st=P();rc=L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
  if rc:
   case=dict(sql=sql,phase='prepare',error=error(db,rc));assert not st.value
  else:
   runs=[]
   for _ in range(2):
    rows=0
    while True:
     rc=L.sqlite3_step(st)
     if rc!=100:break
     rows+=1
    assert rc not in [100,101],(sql,rc)
    observed=error(db,rc)
    reset=L.sqlite3_reset(st)
    runs.append(dict(rowsBeforeError=rows,error=observed,resetCode=reset))
   case=dict(sql=sql,phase='step',runs=runs,finalizeCode=L.sqlite3_finalize(st))
  # Same connection recovers after prepare or step/reset failure.
  recovery=P();assert L.sqlite3_prepare_v2(db,b'SELECT 1',-1,C.byref(recovery),None)==0
  assert L.sqlite3_step(recovery)==100;assert L.sqlite3_step(recovery)==101
  assert L.sqlite3_finalize(recovery)==0
  cases.append(case)
 assert L.sqlite3_close(db)==0
 out['encodings'][enc]=dict(fixtureSha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),cases=cases)
print(json.dumps(out,indent=2))
