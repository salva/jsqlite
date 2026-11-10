import ctypes as c, pathlib, json, subprocess, hashlib, sys
# Relocated original N CF02 native matrix; explicit source/library/node inputs.
root=pathlib.Path(sys.argv[1]).resolve()
libpath=sys.argv[2]
lib=c.CDLL(libpath)
def fn(name,args,result):
 f=getattr(lib,'sqlite3_'+name);f.argtypes=args;f.restype=result;return f
ptr=c.c_void_p;integer=c.c_int;text=c.c_char_p
version=fn('libversion',[],text);sourceid=fn('sourceid',[],text)
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert version().decode()==manifest['version'] and sourceid().decode()==manifest['sqliteSourceId']
print(json.dumps({'version':version().decode(),'sourceId':sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(libpath).read_bytes()).hexdigest()}))
op=fn('open_v2',[text,c.POINTER(ptr),integer,text],integer);prepare=fn('prepare_v2',[ptr,text,integer,c.POINTER(ptr),c.POINTER(text)],integer)
step=fn('step',[ptr],integer);reset=fn('reset',[ptr],integer);finalize=fn('finalize',[ptr],integer);close=fn('close',[ptr],integer);errmsg=fn('errmsg',[ptr],text)
count=fn('column_count',[ptr],integer);typ=fn('column_type',[ptr,integer],integer)
ival=fn('column_int64',[ptr,integer],c.c_longlong);real=fn('column_double',[ptr,integer],c.c_double);txt=fn('column_text',[ptr,integer],ptr);blob=fn('column_blob',[ptr,integer],ptr);size=fn('column_bytes',[ptr,integer],integer)
metadata=[fn('column_'+name,[ptr,integer],text) for name in ['name','decltype','database_name','table_name','origin_name']]
node=sys.argv[3]
queries=json.loads(subprocess.check_output([node,'--experimental-strip-types',str(pathlib.Path(__file__).with_name('matrix.mjs')),'queries',str(root)]))
gen=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
for enc in ['utf8','utf16le','utf16be']:
 path=root/f'test/fixtures/generations/{gen}/generated/subquery-{enc}.db';db=ptr();assert op(str(path).encode(),c.byref(db),1,None)==0
 print(json.dumps({'encoding':enc,'fixture':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}))
 for id,sql in queries:
  if len(sys.argv)>4 and id not in sys.argv[4].split(','):continue
  stmt=ptr();tail=text();rc=prepare(db,sql.encode(),-1,c.byref(stmt),c.byref(tail))
  if rc: print(json.dumps({'enc':enc,'id':id,'phase':'prepare','code':rc,'error':errmsg(db).decode()}));continue
  try:
   md=[dict(zip(['name','declaredType','database','table','origin'],[v.decode() if v is not None else None for v in [f(stmt,i) for f in metadata]])) for i in range(count(stmt))]
   runs=[]
   for cycle in range(2):
    rows=[]
    while (rc:=step(stmt))==100:
     row=[]
     for i in range(count(stmt)):
      t=typ(stmt,i);v=None
      if t==1:v=str(ival(stmt,i))
      elif t==2:v=real(stmt,i)
      elif t==3:v=c.string_at(txt(stmt,i),size(stmt,i)).decode()
      elif t==4:v={'hex':c.string_at(blob(stmt,i),size(stmt,i)).hex()}
      row.append([['','integer','real','text','blob','null'][t],v])
     rows.append(row)
     assert len(rows)<101
    assert rc==101,(id,rc,errmsg(db));runs.append(rows);assert reset(stmt)==0
   print(json.dumps({'enc':enc,'id':id,'metadata':md,'runs':runs}))
  finally:finalize(stmt)
 close(db)
