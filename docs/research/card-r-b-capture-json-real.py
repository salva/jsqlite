"""Pinned jsonAppendSqlValue FLOAT/printf etGENERIC oracle, development only.
Uses the independently built 3.53.4 library; no Python sqlite fallback.
"""
import ctypes as c, hashlib, json, pathlib, sys
lib=pathlib.Path(sys.argv[1]);l=c.CDLL(str(lib));P=c.c_void_p
for name,args,res in [('sqlite3_sourceid',[],c.c_char_p),('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_exec',[P,c.c_char_p,P,P,P],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_count',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],P),('sqlite3_column_blob',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),('sqlite3_column_int64',[P,c.c_int],c.c_int64),('sqlite3_reset',[P],c.c_int),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int)]+[('sqlite3_column_'+n,[P,c.c_int],c.c_char_p) for n in ['name','decltype','database_name','table_name','origin_name']]:
 f=getattr(l,name);f.argtypes=args;f.restype=res
source=l.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
sha=hashlib.sha256(lib.read_bytes()).hexdigest();assert sha=='b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347'
values=['1e-7','1e20','0.0001','0.00001','1e16','1e17','9999999999999999.0','9.999999999999999e-5','1.2345678901234567','49.47','0.1','2.0','-0.0','5e-324','2.2250738585072014e-308','1.7976931348623157e308','-1.7976931348623157e308','1e999','-1e999','NULL','9223372036854775807']
rows=[]
for enc in ['utf8','utf16le','utf16be']:
 db=P();assert l.sqlite3_open(b':memory:',c.byref(db))==0
 pragma={'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc];assert l.sqlite3_exec(db,("PRAGMA encoding='"+pragma+"'").encode(),None,None,None)==0
 for v in values:
  exprs=[f'json_quote({v})',f'json_array({v})',f"json_object('k',{v})",f'jsonb_array({v})',f"jsonb_object('k',{v})",f"json_set('[]','$[#]',{v})",f"jsonb_set('[]','$[#]',{v})",f'json_group_array({v})',f'jsonb_group_array({v})',f"json_group_object('k',{v})",f"jsonb_group_object('k',{v})",f'json_array(jsonb_array({v}))']
  sql='SELECT '+','.join(exprs);s=P();assert l.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(s),None)==0
  metadata=[{n:(getattr(l,'sqlite3_column_'+n)(s,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']} for i in range(len(exprs))]
  results=[]
  for repeat in range(2):
   assert l.sqlite3_step(s)==100;out=[]
   for i in range(len(exprs)):
    typ=l.sqlite3_column_type(s,i);assert typ in [3,4]
    ptr=(l.sqlite3_column_text if typ==3 else l.sqlite3_column_blob)(s,i);b=c.string_at(ptr,l.sqlite3_column_bytes(s,i));out.append(dict(type='text' if typ==3 else 'blob',value=b.decode() if typ==3 else b.hex()))
   results.append(out);assert l.sqlite3_step(s)==101;assert l.sqlite3_reset(s)==0
  assert results[0]==results[1];assert l.sqlite3_finalize(s)==0
  rows.append(dict(enc=enc,value=v,sql=sql,metadata=metadata,expected=results[0]))
 assert l.sqlite3_close(db)==0
pathlib.Path(sys.argv[2]).write_text(json.dumps(dict(source=source,library_sha256=sha,rows=rows),indent=2)+'\n');print('captured',len(rows),'statements twice')
