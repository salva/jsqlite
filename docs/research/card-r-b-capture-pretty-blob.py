"""Development-only full pretty/BLOB-document native capture.
Usage: script LIB INVENTORY OUTPUT. Inventory is original SQL, never TS results.
"""
import ctypes as c,json,pathlib,hashlib,sys
P=c.c_void_p
lib=c.CDLL(sys.argv[1])
for n,a,r in [('open',[c.c_char_p,c.POINTER(P)],c.c_int),('exec',[P,c.c_char_p,P,P,P],c.c_int),('prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('step',[P],c.c_int),('reset',[P],c.c_int),('finalize',[P],c.c_int),('close',[P],c.c_int),('column_count',[P],c.c_int),('column_type',[P,c.c_int],c.c_int),('column_text',[P,c.c_int],P),('column_blob',[P,c.c_int],P),('column_bytes',[P,c.c_int],c.c_int),('errmsg',[P],c.c_char_p),('extended_errcode',[P],c.c_int),('sourceid',[],c.c_char_p),('compileoption_get',[c.c_int],c.c_char_p),*[(f'column_{n}',[P,c.c_int],c.c_char_p) for n in ['name','decltype','database_name','table_name','origin_name']]]:
 f=getattr(lib,'sqlite3_'+n);f.argtypes=a;f.restype=r
sid=lib.sqlite3_sourceid().decode();assert sid=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
opts=[]
for i in range(200):
 v=lib.sqlite3_compileoption_get(i)
 if v is None:break
 opts.append(v.decode())
assert 'ENABLE_COLUMN_METADATA' in opts and 'ENABLE_MATH_FUNCTIONS' in opts
inventory=json.loads(pathlib.Path(sys.argv[2]).read_text())
out={'sourceId':sid,'compileOptions':opts,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':{}}
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
 assert lib.sqlite3_exec(db,f"PRAGMA encoding='{pragma}';CREATE TABLE anchor(x)".encode(),None,None,None)==0
 s=P();assert lib.sqlite3_prepare_v2(db,b'PRAGMA encoding',-1,c.byref(s),None)==0;assert lib.sqlite3_step(s)==100;assert c.string_at(lib.sqlite3_column_text(s,0)).decode().lower()==pragma.lower();lib.sqlite3_finalize(s)
 result={}
 for family,sqls in inventory.items():
  cases=[]
  for sql in sqls:
   s=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(s),None)==0,sql
   metas=[]
   for i in range(lib.sqlite3_column_count(s)):
    m={}
    for key,n in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
     v=getattr(lib,'sqlite3_column_'+n)(s,i);m[key]=v.decode() if v is not None else None
    metas.append(m)
   def run():
    rows=[]
    while True:
     rc=lib.sqlite3_step(s)
     if rc==101:return {'rows':rows}
     if rc!=100:return {'rows':rows,'error':lib.sqlite3_errmsg(db).decode(),'code':rc,'extendedCode':lib.sqlite3_extended_errcode(db)}
     row=[]
     for i in range(len(metas)):
      t=lib.sqlite3_column_type(s,i);v=None
      if t!=5:
       p=(lib.sqlite3_column_blob if t==4 else lib.sqlite3_column_text)(s,i);b=c.string_at(p,lib.sqlite3_column_bytes(s,i));v=b.hex().upper() if t==4 else b.decode()
      row.append({'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t],'value':v})
     rows.append(row)
   first=run();assert lib.sqlite3_reset(s)==first.get('code',0);assert run()==first;assert lib.sqlite3_finalize(s)==first.get('code',0)
   cases.append({'sql':sql,'metadata':metas,**first})
  result[family]=cases
 assert lib.sqlite3_close(db)==0
 out['encodings'][enc]=result
pathlib.Path(sys.argv[3]).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(sid,out['librarySha256'],{e:{k:len(v) for k,v in x.items()} for e,x in out['encodings'].items()})
