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
for function in ['json_each','json_tree','jsonb_each','jsonb_tree']:
 def q(id,sql): cases.append({'id':function+'-'+id,'sql':sql.replace('@',function)})
 q('typed',"SELECT t.c,j.key,j.value,j.type,j.atom,j.id,j.parent,j.fullkey,j.path,j.json,j.root FROM t1 t CROSS JOIN @('{\"é\":1.5,\"d\":2,\"d\":3}') j")
 q('binary',"SELECT j.value,typeof(j.value) FROM t1 t INNER JOIN @(jsonb('[[1]]')) j ON 1")
 for value in ['NULL',"'[]'"]:
  q('left-'+value,"SELECT t.c,j.value,j.json,j.root FROM t1 t LEFT JOIN @("+value+") j ON 1")
 q('dynamic-root',"SELECT j.atom,j.fullkey FROM t1 t LEFT JOIN @('{\"I\":[1,2]}','$."+"' || t.b) j ON j.atom=t.c")
 q('collation',"SELECT j.value COLLATE NOCASE AS v FROM t1 t INNER JOIN @('[\"i\",\"x\"]') j ON j.value=t.b COLLATE NOCASE")
 q('membership',"SELECT t.c,j.atom FROM t1 t CROSS JOIN @('[1,2]') j WHERE j.atom IN (1,2) AND (t.c,j.atom) IN ((1,2))")
 q('nested',"SELECT j.atom+1 AS n FROM t1 t INNER JOIN @((SELECT '[1]')) j ON j.atom=(SELECT 1)")
 q('aggregate',"SELECT t.b,count(j.atom),sum(j.atom)+1,count(*) FILTER (WHERE j.atom>1) FROM t1 t LEFT JOIN @('[1,2]') j ON 1 GROUP BY t.b")
 q('empty-aggregate',"SELECT t.b,count(j.atom),count(*),sum(j.atom) FROM t1 t LEFT JOIN @('[]') j ON 1 GROUP BY t.b")
 q('malformed',"SELECT j.atom FROM t1 t LEFT JOIN @('{') j ON 1")
 # Header-width and retained lexical label branches owning cursor offsets.
 for size in [10,11,12,254,255,256]:
  document='['+','.join(['0']*size)+']'
  q('header-'+str(size),"SELECT j.id,j.parent,j.fullkey,j.atom FROM t1 t CROSS JOIN @('"+document+"') j")
 document=r'{"a\u0062":{"x":[1,2]},"c":3}'
 q('escaped-root',"SELECT j.id,j.parent,j.fullkey,j.atom FROM t1 t CROSS JOIN @('"+document+"','$.ab') j")

output={'identity':identity,'cases':[]}
for encoding in ['utf8','utf16le','utf16be']:
 d=P();assert lib.sqlite3_open_v2(str(root/f'test/fixtures/generations/{g}/generated/encoding-{encoding}.db').encode(),C.byref(d),1,None)==0
 for case in cases:
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
