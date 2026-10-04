# Development-only independently pinned read-only oracle; no snapshot mutation.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
for name,args in [('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P]),('step',[P]),('finalize',[P]),('close',[P]),('bind_null',[P,C.c_int]),('bind_int64',[P,C.c_int,C.c_longlong]),('reset',[P]),('clear_bindings',[P]),('column_type',[P,C.c_int]),('column_int64',[P,C.c_int])]:getattr(L,'sqlite3_'+name).argtypes=args
L.sqlite3_column_int64.restype=C.c_longlong;L.sqlite3_sourceid.restype=C.c_char_p
sql='SELECT a FROM t WHERE a=1'
L.sqlite3_column_text.argtypes=[P,C.c_int];L.sqlite3_column_text.restype=C.c_char_p
base=json.load(open('test/conformance/cases/row-width-native.json'));out={'sourceId':L.sqlite3_sourceid().decode(),'sql':sql,'variants':[]}
for v in base['variants']:
 if not v['state'].startswith('tie-'):continue
 db=P();assert L.sqlite3_open_v2(v['fixture'].encode(),C.byref(db),1,None)==0
 st=P();assert L.sqlite3_prepare_v2(db,('EXPLAIN QUERY PLAN '+sql).encode(),-1,C.byref(st),None)==0
 eqp=[]
 while L.sqlite3_step(st)==100:eqp.append(L.sqlite3_column_text(st,3).decode())
 assert L.sqlite3_finalize(st)==0
 assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 rows=[]
 while L.sqlite3_step(st)==100:rows.append(str(L.sqlite3_column_int64(st,0)))
 assert L.sqlite3_finalize(st)==0;assert L.sqlite3_close(db)==0
 path=pathlib.Path(v['fixture'])
 out['variants'].append({'encoding':v['encoding'],'state':v['state'],'fixture':v['fixture'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'eqp':eqp,'rows':rows})
pathlib.Path('test/conformance/cases/row-width-insertion-tie-native.json').write_text(json.dumps(out,indent=2)+'\n')
print([(v['encoding'],v['state'],v['eqp']) for v in out['variants']])
