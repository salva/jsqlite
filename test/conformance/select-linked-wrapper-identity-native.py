import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_text',[P,C.c_int],C.c_char_p),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int)]:
 f=getattr(L,n);f.argtypes=a;f.restype=r
root=pathlib.Path('.');assert L.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
for fixture,table,expected in [('expr-where','t',[(5,None),(3,'abc'),(3,'XYZ')]),('encoding-utf8','t1',[(3,'one')]),('encoding-utf16le','t1',[(3,'one')]),('encoding-utf16be','t1',[(3,'one')])]:
 db=P();assert L.sqlite3_open(str(root/'test/fixtures/generations'/g/'generated'/f'{fixture}.db').encode(),C.byref(db))==0
 for expr in ['a COLLATE nocase','((a COLLATE nocase))']:
  sql=f'SELECT DISTINCT {expr} FROM {table} GROUP BY {expr} ORDER BY 1';s=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None)==0
  for iteration in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(s)
    if rc==101:break
    assert rc==100;typ=L.sqlite3_column_type(s,0);v=L.sqlite3_column_text(s,0);rows.append((typ,v.decode() if v else None))
   assert rows==expected,(fixture,rows);assert L.sqlite3_reset(s)==0
  assert L.sqlite3_finalize(s)==0
 assert L.sqlite3_close(db)==0
 print(fixture,'2 shapes x2 reset typed pass')
