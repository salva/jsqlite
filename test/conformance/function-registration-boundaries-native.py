#!/usr/bin/env python3
"""Pinned public registration/body boundary counterpart (no generated golden)."""
import ctypes as C,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2];lib=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,t in [('sourceid',[],C.c_char_p),('open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_text',[P,C.c_int],P),('column_blob',[P,C.c_int],P),('column_bytes',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_longlong),('bind_int64',[P,C.c_int,C.c_longlong],C.c_int),('errmsg',[P],C.c_char_p),('reset',[P],C.c_int),('finalize',[P],C.c_int),('close',[P],C.c_int)]:
 f=getattr(lib,'sqlite3_'+n);f.argtypes=a;f.restype=t
for n in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(lib,'sqlite3_column_'+n);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert lib.sqlite3_sourceid().decode()==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
cases=[('strftime()',5,None),("strftime('%Y','2000-01-02')",3,'2000')]
for prefix in ['json','jsonb']:
 for mode in ['set','insert','replace','array_insert','remove','extract']:
  f=f'{prefix}_{mode}';blob=prefix=='jsonb'
  cases += [(f'{f}()',5,None),(f"{f}('{{}}')",5 if mode=='extract' else 4 if blob else 3,None if mode=='extract' else '0c' if blob else '{}')]
  if mode=='extract':cases.append((f"{f}('malformed')",5,None))
  if mode not in ['extract','remove']:
   for doc in ["'{}'",'NULL',"'malformed'"]:cases.append((f"{f}({doc},'$.a')",'error',f'json_{mode}() needs an odd number of arguments'))
   cases.append((f"{f}('[0]','$[0]',1)",4 if blob else 3,('2b1330' if mode=='insert' else '4b13311330' if mode=='array_insert' else '2b1331') if blob else ('[0]' if mode=='insert' else '[1,0]' if mode=='array_insert' else '[1]')))
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
for enc in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/subquery-{enc}.db').encode(),C.byref(d),1,None)==0
 def prepare(sql):
  s=P();assert lib.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0,(sql,lib.sqlite3_errmsg(d));return s
 try:
  for expr,typ,value in cases:
   s=prepare(f'SELECT {expr} AS v')
   assert [getattr(lib,'sqlite3_column_'+n)(s,0) for n in ['name','decltype','database_name','table_name','origin_name']]==[b'v',None,None,None,None]
   if typ=='error':
    assert lib.sqlite3_step(s)==1,expr
    assert lib.sqlite3_errmsg(d).decode()==value,expr
    assert lib.sqlite3_reset(s)==1
   else:
    for cycle in range(2):
     assert lib.sqlite3_step(s)==100,expr
     assert lib.sqlite3_column_type(s,0)==typ,expr
     actual=None
     if typ in [3,4]:
      p=(lib.sqlite3_column_blob if typ==4 else lib.sqlite3_column_text)(s,0);data=C.string_at(p,lib.sqlite3_column_bytes(s,0));actual=data.hex() if typ==4 else data.decode()
     assert actual==value,(expr,actual,value)
     assert lib.sqlite3_step(s)==101
     assert lib.sqlite3_reset(s)==0
   assert lib.sqlite3_finalize(s)==0
   s=prepare('SELECT min(?1,9) AS v')
   for v in [1,7]:
    assert lib.sqlite3_bind_int64(s,1,v)==0
    assert lib.sqlite3_step(s)==100
    assert lib.sqlite3_column_type(s,0)==1 and lib.sqlite3_column_int64(s,0)==v
    assert lib.sqlite3_step(s)==101 and lib.sqlite3_reset(s)==0
   assert lib.sqlite3_finalize(s)==0
  for f in ['min','max']:
   s=P();assert lib.sqlite3_prepare_v2(d,f'SELECT {f}()'.encode(),-1,C.byref(s),None)==1
   assert lib.sqlite3_errmsg(d).decode()==f'wrong number of arguments to function {f}()' and not s.value
  print(enc,'PASS:',len(cases),'metadata/type/body-phase/two-cycle cases plus min/max0 and same-handle rebind after errors')
 finally:assert lib.sqlite3_close(d)==0
