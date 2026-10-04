# Development-only independently pinned read-only oracle; no snapshot mutation.
import ctypes as C, pathlib, os, json, hashlib
P=C.c_void_p
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so')
for name,args in [('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P]),('step',[P]),('finalize',[P]),('close',[P]),('bind_null',[P,C.c_int]),('bind_int64',[P,C.c_int,C.c_longlong]),('reset',[P]),('clear_bindings',[P]),('column_type',[P,C.c_int]),('column_int64',[P,C.c_int])]:getattr(L,'sqlite3_'+name).argtypes=args
L.sqlite3_column_int64.restype=C.c_longlong;L.sqlite3_sourceid.restype=C.c_char_p
sql='SELECT x.id,y.id FROM t x LEFT JOIN t y INDEXED BY t_ab ON y.a IN (?1,x.a,NULL) AND y.b IN (?2,NULL) AND y.id=x.id WHERE x.id IN (12,13,14,214) ORDER BY x.id DESC,y.id'
base=json.load(open('test/conformance/cases/in-range-stat-native.json'));out={'sourceId':L.sqlite3_sourceid().decode(),'sql':sql,'variants':[]}
for v in base['variants']:
 db=P();assert L.sqlite3_open_v2(v['fixture'].encode(),C.byref(db),1,None)==0
 st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
 runs=[]
 for binds in [[None,None],[1,13],[None,14],[2,None],[1,12],[2,13],[None,214],[1,None]]:
  assert L.sqlite3_reset(st)==0;assert L.sqlite3_clear_bindings(st)==0
  for i,b in enumerate(binds,1):assert (L.sqlite3_bind_null(st,i) if b is None else L.sqlite3_bind_int64(st,i,b))==0
  rows=[]
  while True:
   rc=L.sqlite3_step(st)
   if rc==101:break
   assert rc==100,rc
   rows.append([None if L.sqlite3_column_type(st,i)==5 else str(L.sqlite3_column_int64(st,i)) for i in range(2)])
  runs.append({'bindings':binds,'rows':rows})
 assert L.sqlite3_finalize(st)==0;assert L.sqlite3_close(db)==0
 out['variants'].append({'encoding':v['encoding'],'state':v['state'],'fixture':v['fixture'],'fixtureBytes':pathlib.Path(v['fixture']).stat().st_size,'fixtureSha256':hashlib.sha256(pathlib.Path(v['fixture']).read_bytes()).hexdigest(),'runs':runs})
pathlib.Path('test/conformance/cases/row-width-left-in-transitions-native.json').write_text(json.dumps(out,indent=2)+'\n')
