import ctypes as C,json,os
L=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so');P=C.c_void_p
for n,a,r in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,n);f.argtypes=a;f.restype=r
sid=L.sqlite3_sourceid().decode();assert sid==json.load(open('reference/sqlite/manifest.json'))['sqliteSourceId'];print(json.dumps({'sourceId':sid}))
d=P();assert L.sqlite3_open(b':memory:',C.byref(d))==0
for item in json.load(open('docs/research/card-r-f/cases.json')):
 sql=item['sql'];s=P();assert L.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0;assert L.sqlite3_step(s)==100
 v=L.sqlite3_column_text(s,0);actual=None if v is None else v.decode();assert actual==item['value'],(sql,actual,item['value']);assert L.sqlite3_column_type(s,0)=={'null':5,'integer':1,'text':3}[item['type']];assert L.sqlite3_column_name(s,0).decode()==sql[7:]
 print(json.dumps({'sql':sql,'column':sql[7:],'type':item['type'],'value':actual}));assert L.sqlite3_finalize(s)==0
assert L.sqlite3_close(d)==0
