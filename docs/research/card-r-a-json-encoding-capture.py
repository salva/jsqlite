"""Recapture existing six JSON corpora using pinned C API, never candidate output."""
import ctypes as C, hashlib, json, pathlib, sys
libpath, corpusroot, output = sys.argv[1:]
L=C.CDLL(libpath)
def api(n,args,rest=C.c_int):
 f=getattr(L,'sqlite3_'+n);f.argtypes=args;f.restype=rest;return f
ptr=C.c_void_p; I=C.c_int; S=C.c_char_p
open_=api('open',[S,C.POINTER(ptr)]);close=api('close',[ptr]);prepare=api('prepare_v2',[ptr,S,I,C.POINTER(ptr),ptr]);step=api('step',[ptr]);final=api('finalize',[ptr]);reset=api('reset',[ptr]);bindtext=api('bind_text',[ptr,I,ptr,I,ptr]);bindblob=api('bind_blob',[ptr,I,ptr,I,ptr]);typ=api('column_type',[ptr,I]);txt=api('column_text',[ptr,I],ptr);blob=api('column_blob',[ptr,I],ptr);size=api('column_bytes',[ptr,I]);err=api('errmsg',[ptr],S);name=api('column_name',[ptr,I],S);count=api('column_count',[ptr]);source=api('sourceid',[],S);version=api('libversion',[],S)
assert version()==b'3.53.4'
assert source()==b'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
root=pathlib.Path(corpusroot);result={'version':version().decode(),'sourceId':source().decode(),'librarySha256':hashlib.sha256(pathlib.Path(libpath).read_bytes()).hexdigest(),'compileOptions':[], 'suites':{}}
names=['json-string','json-text','json-token','json-ws','jsonb-unicode','jsonb-validation']
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 db=ptr();assert open_(b':memory:',C.byref(db))==0
 def run(sql,raw=None,storage=None):
  st=ptr();assert prepare(db,sql.encode(),-1,C.byref(st),None)==0,err(db)
  try:
   if raw is not None:
    b=C.create_string_buffer(raw);assert (bindtext if storage=='text' else bindblob)(st,1,b,len(raw),ptr(-1))==0
   metadata=[name(st,i).decode() for i in range(count(st))]
   observations=[]
   for _ in range(2):
    rc=step(st)
    if rc!=100:observations.append({'error':err(db).decode(),'code':rc})
    else:
     values=[]
     for i in range(count(st)):
      t=typ(st,i);p=blob(st,i) if t==4 else txt(st,i);v=None if t==5 else C.string_at(p,size(st,i)).hex() if t==4 else C.string_at(p,size(st,i)).decode('utf8');values.append({'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t],'value':v})
     observations.append({'values':values})
    reset(st)
   return {'metadata':metadata,'steps':observations}
  finally:final(st)
 run("PRAGMA encoding='"+pragma+"'")
 if enc=='utf8':
  st=ptr();assert prepare(db,b'PRAGMA compile_options',-1,C.byref(st),None)==0
  while step(st)==100:result['compileOptions'].append(C.string_at(txt(st,0),size(st,0)).decode())
  final(st)
 for suite in names:
  rows=json.loads((root/(suite+'-native.json')).read_text());out=[]
  flags=[1,2,4,8,15] if suite=='json-text' else [4,8,15] if suite=='jsonb-unicode' else [1,2,15] if suite in ['json-string','json-token','json-ws'] else [1,2,4,8,12]
  sql='SELECT '+','.join('json_valid(?1,%d)'%f for f in flags)+',json_error_position(?1)'
  for row in rows:
   raw=bytes.fromhex(row['hex']);storage=row.get('storage','blob');item={'validation':run(sql,raw,storage)}
   if row.get('render') is not None:item['render']=run('SELECT hex(json(?1)),hex(jsonb(?1))',raw,storage)
   if row.get('composition') is not None:item['composition']=run("SELECT json_type(?1),typeof(json_extract(?1,'$')),hex(json(jsonb(?1)))",raw,storage)
   out.append(item)
  result['suites'].setdefault(suite,{'inputs':rows,'inputSha256':hashlib.sha256((root/(suite+'-native.json')).read_bytes()).hexdigest(),'sql':sql,'encodings':{}})['encodings'][enc]=out
  print(enc,suite,len(out),flush=True)
 close(db)
pathlib.Path(output).write_text(json.dumps(result,separators=(',',':'))+'\n')
