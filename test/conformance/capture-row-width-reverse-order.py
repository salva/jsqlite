# Development-only independently pinned read-only oracle; no snapshot mutation.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
for name,args in [('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P]),('step',[P]),('finalize',[P]),('close',[P]),('bind_null',[P,C.c_int]),('bind_int64',[P,C.c_int,C.c_longlong]),('reset',[P]),('clear_bindings',[P]),('column_type',[P,C.c_int]),('column_int64',[P,C.c_int])]:getattr(L,'sqlite3_'+name).argtypes=args
L.sqlite3_column_int64.restype=C.c_longlong;L.sqlite3_sourceid.restype=C.c_char_p
L.sqlite3_stmt_status.argtypes=[P,C.c_int,C.c_int]
base=json.load(open('test/conformance/cases/stage3-advanced-index.json'));out={'sourceId':L.sqlite3_sourceid().decode(),'variants':[]}
for v in base['variants']:
 for hint in ['INDEXED BY m_abc','NOT INDEXED']:
  sql=f'SELECT y.b FROM m x JOIN m y {hint} ON y.a=x.a WHERE x.id=2 AND y.b>=1 AND y.b<=3 ORDER BY y.b DESC'
  path=v['fixture']['path'];db=P();assert L.sqlite3_open_v2(path.encode(),C.byref(db),1,None)==0
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  rows=[]
  while L.sqlite3_step(st)==100:rows.append(str(L.sqlite3_column_int64(st,0)))
  sort=L.sqlite3_stmt_status(st,2,0);assert L.sqlite3_finalize(st)==0;assert L.sqlite3_close(db)==0
  out['variants'].append({'id':v['id'],'fixture':path,'hint':hint,'sql':sql,'rows':rows,'sort':sort,'sha256':hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()})
pathlib.Path('test/conformance/cases/row-width-reverse-order-native.json').write_text(json.dumps(out,indent=2)+'\n')
print([(v['id'],v['hint'],v['sort']) for v in out['variants']])
