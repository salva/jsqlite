"""Development-only pinned C oracle. Read-only fixtures; no runtime integration."""
import ctypes as C,json,os,pathlib,sys,base64
root=pathlib.Path(__file__).resolve().parents[2]
lib=C.CDLL(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so');P=C.c_void_p
for name,args,res in [('sqlite3_libversion',[],C.c_char_p),('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_reset',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_errmsg',[P],C.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=res
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(lib,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
identity={'version':lib.sqlite3_libversion().decode(),'sourceId':lib.sqlite3_sourceid().decode()}
assert identity=={'version':'3.53.4','sourceId':'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'}

lib.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,P];lib.sqlite3_exec.restype=C.c_int
out=[]
for enc in ['utf8','utf16le','utf16be']:
 path=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'resolution-repair'/('collision-'+enc+'.db')
 if path.exists():path.unlink()
 db=P();assert lib.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 encoding={'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc]
 names=['value','key','type','atom','id','parent','fullkey','path','json','root']
 ddl='PRAGMA encoding="'+encoding+'"; CREATE TABLE t('+','.join('"'+n+'" INTEGER' for n in names)+'); INSERT INTO t VALUES('+','.join(['10']*10)+');'
 assert lib.sqlite3_exec(db,ddl.encode(),None,None,None)==0
 for module in ['json_each','json_tree','jsonb_each','jsonb_tree']:
  for clause in ['WHERE','ON']:
   for name in names:
    for expression in [name+'=10','coalesce('+name+',0)=10 AND t.rowid>0']:
     sql=f"SELECT t.rowid,j.value FROM t JOIN {module}('[10]') j {clause} ({expression}) ORDER BY t.rowid,j.key"
     stmt=P();code=lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(stmt),None);msg=lib.sqlite3_errmsg(db).decode()
     assert code==1 and msg=='ambiguous column name: '+name,(sql,code,msg)
     out.append(dict(encoding=enc,sql=sql,name=name,code=code,message=msg,phase='prepare',fixture=base64.b64encode(path.read_bytes()).decode()))
     if stmt:lib.sqlite3_finalize(stmt)
 lib.sqlite3_close(db)


cases=[{'id': 'json_each-WHERE-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j WHERE (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-WHERE-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j WHERE (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-WHERE-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j WHERE (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-WHERE-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j WHERE (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-ON-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j ON (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-ON-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j ON (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-ON-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j ON (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-ON-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('bad') j ON (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_each-left-t.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_each('bad') j ON t.value<0 ORDER BY t.rowid,j.key"}, {'id': 'json_each-left-t.value>0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_each('bad') j ON t.value>0 ORDER BY t.rowid,j.key"}, {'id': 'json_each-left-j.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_each('bad') j ON j.value<0 ORDER BY t.rowid,j.key"}, {'id': 'json_each-valid-t.value=10 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('[10]') j ON (t.value=10 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'json_each-valid-t.value<0 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_each('[10]') j ON (t.value<0 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-WHERE-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j WHERE (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-WHERE-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j WHERE (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-WHERE-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j WHERE (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-WHERE-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j WHERE (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-ON-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j ON (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-ON-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j ON (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-ON-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j ON (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-ON-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('bad') j ON (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-left-t.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_tree('bad') j ON t.value<0 ORDER BY t.rowid,j.key"}, {'id': 'json_tree-left-t.value>0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_tree('bad') j ON t.value>0 ORDER BY t.rowid,j.key"}, {'id': 'json_tree-left-j.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN json_tree('bad') j ON j.value<0 ORDER BY t.rowid,j.key"}, {'id': 'json_tree-valid-t.value=10 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('[10]') j ON (t.value=10 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'json_tree-valid-t.value<0 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN json_tree('[10]') j ON (t.value<0 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-WHERE-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j WHERE (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-WHERE-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j WHERE (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-WHERE-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j WHERE (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-WHERE-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j WHERE (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-ON-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j ON (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-ON-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j ON (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-ON-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j ON (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-ON-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('bad') j ON (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-left-t.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_each('bad') j ON t.value<0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-left-t.value>0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_each('bad') j ON t.value>0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-left-j.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_each('bad') j ON j.value<0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-valid-t.value=10 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('[10]') j ON (t.value=10 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_each-valid-t.value<0 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_each('[10]') j ON (t.value<0 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-WHERE-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j WHERE (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-WHERE-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j WHERE (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-WHERE-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j WHERE (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-WHERE-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j WHERE (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-ON-physical-skip', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j ON (t.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-ON-physical-survive', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j ON (t.value>0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-ON-json-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j ON (j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-ON-mixed-residual', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('bad') j ON (t.value>0 AND j.value<0) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-left-t.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_tree('bad') j ON t.value<0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-left-t.value>0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_tree('bad') j ON t.value>0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-left-j.value<0', 'sql': "SELECT t.rowid,j.value FROM t LEFT JOIN jsonb_tree('bad') j ON j.value<0 ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-valid-t.value=10 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('[10]') j ON (t.value=10 AND j.value=10) ORDER BY t.rowid,j.key"}, {'id': 'jsonb_tree-valid-t.value<0 AND j.value=10', 'sql': "SELECT t.rowid,j.value FROM t JOIN jsonb_tree('[10]') j ON (t.value<0 AND j.value=10) ORDER BY t.rowid,j.key"}]
output={'identity':identity,'cases':[]}
for encoding in ['utf8','utf16le','utf16be']:
 for case in cases:
  fixture=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'resolution-repair'/('collision-'+encoding+'.db')
  d=P();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(d),1,None)==0
  s=P();rc=lib.sqlite3_prepare_v2(d,case['sql'].encode(),-1,C.byref(s),None);entry=dict(case,encoding=encoding,fixture=base64.b64encode(fixture.read_bytes()).decode(),columns=[],rows=[])
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
   entry['resetCode']=lib.sqlite3_reset(s)
   repeated=[]
   while (again:=lib.sqlite3_step(s))==100:
    row=[]
    for i in range(lib.sqlite3_column_count(s)):
     t=lib.sqlite3_column_type(s,i);v=None
     if t==1:v=str(lib.sqlite3_column_int64(s,i))
     elif t==2:v=lib.sqlite3_column_double(s,i)
     elif t in [3,4]:
      p=lib.sqlite3_column_text(s,i) if t==3 else lib.sqlite3_column_blob(s,i);b=C.string_at(p,lib.sqlite3_column_bytes(s,i));v=b.decode() if t==3 else b.hex()
     row.append({'type':['','integer','real','text','blob','null'][t],'value':v})
    repeated.append(row)
   assert repeated==entry['rows'] and again==rc
   entry['repeatEndCode']=again
  lib.sqlite3_finalize(s);output['cases'].append(entry)
  lib.sqlite3_close(d)

fixtures={entry['encoding']:entry['fixture'] for entry in out}
for entry in out+output['cases']:del entry['fixture']
print(json.dumps({"identity":identity,"fixtures":fixtures,"cases":out,"controls":output["cases"]},indent=2))
