"""Finite hidden-column oracle; development-only pinned native library."""
import ctypes as c, json, os, pathlib
l=c.CDLL(os.environ['HIDDEN_BLOB_ORACLE_LIBRARY'])
p=c.c_void_p
signatures={'open':([c.c_char_p,c.POINTER(p)],c.c_int),'prepare_v2':([p,c.c_char_p,c.c_int,c.POINTER(p),p],c.c_int),'step':([p],c.c_int),'finalize':([p],c.c_int),'close':([p],c.c_int),'column_count':([p],c.c_int),'column_type':([p,c.c_int],c.c_int),'column_int64':([p,c.c_int],c.c_longlong),'column_double':([p,c.c_int],c.c_double),'column_blob':([p,c.c_int],p),'column_bytes':([p,c.c_int],c.c_int),'column_text':([p,c.c_int],c.c_char_p),'libversion_number':([],c.c_int),'sourceid':([],c.c_char_p)}
for name in ['name','decltype','database_name','table_name','origin_name']:signatures['column_'+name]=([p,c.c_int],c.c_char_p)
for name,(args,ret) in signatures.items():
 f=getattr(l,'sqlite3_'+name);f.argtypes=args;f.restype=ret
source='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
assert l.sqlite3_libversion_number()==3053004 and l.sqlite3_sourceid().decode()==source
document=json.dumps(list(range(64)),separators=(',',':'))
cases=[]
for encoding,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 db=p();assert l.sqlite3_open(b':memory:',c.byref(db))==0
 def query(sql):
  s=p();assert l.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(s),None)==0,sql
  columns=[]
  for i in range(l.sqlite3_column_count(s)):
   columns.append({key:(v.decode() if v is not None else None) for key,v in [(key,getattr(l,'sqlite3_column_'+name)(s,i)) for key,name in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]]})
  rows=[]
  while True:
   rc=l.sqlite3_step(s)
   if rc==101:break
   assert rc==100,(rc,sql)
   row=[]
   for i in range(len(columns)):
    t=l.sqlite3_column_type(s,i);kind={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t]
    value=str(l.sqlite3_column_int64(s,i)) if t==1 else l.sqlite3_column_double(s,i) if t==2 else l.sqlite3_column_text(s,i).decode() if t==3 else c.string_at(l.sqlite3_column_blob(s,i),l.sqlite3_column_bytes(s,i)).hex() if t==4 else None
    row.append({'type':kind,'value':value})
   rows.append(row)
  assert l.sqlite3_finalize(s)==0
  return columns,rows
 query("PRAGMA encoding='"+pragma+"'")
 blob=query("SELECT jsonb('"+document+"')")[1][0][0]['value']
 for storage,arg in [('text',"'"+document+"'"),('blob',"x'"+blob+"'")]:
  for module in ['json_each','json_tree','jsonb_each','jsonb_tree']:
   for projection in ['value','root','*','json']:
    sql=f'SELECT {projection} FROM {module}({arg})'
    columns,rows=query(sql)
    cases.append(dict(encoding=encoding,storage=storage,module=module,projection=projection,sql=sql,columns=columns,rows=rows))
 assert l.sqlite3_close(db)==0
out=pathlib.Path(__file__).with_name('card-r-e-hidden-blob-native.json')
out.write_text(json.dumps(dict(version=3530400,libraryVersionNumber=l.sqlite3_libversion_number(),sourceId=source,document=document,blob=blob,cases=cases),indent=2)+'\n')
print(f'{len(cases)} native cases -> {out}')
