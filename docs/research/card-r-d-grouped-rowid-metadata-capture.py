"""Development-only pinned C oracle. Read-only fixtures; no runtime integration."""
import ctypes as C,json,os,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
lib=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so');P=C.c_void_p
for name,args,res in [('sqlite3_libversion',[],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_errmsg',[P],C.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=res
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(lib,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
identity={'version':lib.sqlite3_libversion().decode(),'sourceId':lib.sqlite3_sourceid().decode()}
assert identity=={'version':'3.53.4','sourceId':'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'}
g=json.load(open(root/'test/fixtures/CURRENT.json'))['generationId'];cases=[]
for physical,table in [('nonipk','t1'),('ipk','t')]:
 for function in ['json_each','json_tree','jsonb_each','jsonb_tree']:
  for id,sql in [
   ('aliases-group',"SELECT j._rowid_ AS same,j.oid AS same,t.rowid AS physical,j.rowid+0 AS computed,count(*) FROM @P t CROSS JOIN @J('[10,20]') j GROUP BY j.rowid,t.rowid HAVING j.rowid>=0"),
   ('correlated-group',"SELECT j.rowid AS identity,j.value AS payload,count(*) FROM @P t CROSS JOIN @J('['||t.rowid||']') j GROUP BY j.rowid,j.value"),
   ('predicate-only',"SELECT count(*) AS total FROM @P t CROSS JOIN @J('[10,20]') j WHERE j.rowid>=0"),
   ('aliases-null',"SELECT j._rowid_ AS same,j.oid AS same,j.rowid+0 AS computed,count(*) FROM @P t LEFT JOIN @J('[]') j ON j.rowid<0 GROUP BY j.rowid"),
  ]:cases.append({'id':physical+'-'+function+'-'+id,'physical':physical,'sql':sql.replace('@P',table).replace('@J',function)})
output={'identity':identity,'cases':[]}
for encoding in ['utf8','utf16le','utf16be']:
 for case in cases:
  fixture=(root/f'test/fixtures/generations/{g}/generated/encoding-{encoding}.db') if case['physical']=='nonipk' else root/f'test/conformance/fixtures/row-width-ipk-{dict(utf8="utf-8",utf16le="utf-16le",utf16be="utf-16be")[encoding]}.db'
  d=P();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(d),1,None)==0
  s=P();rc=lib.sqlite3_prepare_v2(d,case['sql'].encode(),-1,C.byref(s),None);entry=dict(case,encoding=encoding,columns=[],rows=[])
  if rc:entry['error']={'phase':'prepare','code':rc,'message':lib.sqlite3_errmsg(d).decode()}
  else:
   for i in range(lib.sqlite3_column_count(s)):
    col={}
    for key,suffix in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
     v=getattr(lib,'sqlite3_column_'+suffix)(s,i);col[key]=None if v is None else v.decode()
    entry['columns'].append(col)
   while (rc:=lib.sqlite3_step(s))==100:
    row=[]
    for i in range(lib.sqlite3_column_count(s)):
     t=lib.sqlite3_column_type(s,i);v=None
     if t==1:v=str(lib.sqlite3_column_int64(s,i))
     elif t==2:v=lib.sqlite3_column_double(s,i)
     elif t in [3,4]:
      p=lib.sqlite3_column_text(s,i) if t==3 else lib.sqlite3_column_blob(s,i);b=C.string_at(p,lib.sqlite3_column_bytes(s,i));v=b.decode() if t==3 else b.hex()
     row.append({'type':['','integer','real','text','blob','null'][t],'value':v})
    entry['rows'].append(row)
   if rc!=101:entry['error']={'phase':'step','code':rc,'message':lib.sqlite3_errmsg(d).decode()}
  lib.sqlite3_finalize(s);output['cases'].append(entry)
  lib.sqlite3_close(d)
json.dump(output,sys.stdout,ensure_ascii=False,indent=2);print()
