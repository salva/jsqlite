"""Development-only SQLite 3.53.4 oracle for the retained scalar/raw inventories.
Usage: python3 SCRIPT pinned-libsqlite3.so output.json
No candidate output is an input. Original SQL is retained verbatim.
"""
import ctypes as c
import hashlib,json,pathlib,re,sys
P=c.c_void_p
lib=c.CDLL(sys.argv[1])
for name,args,ret in [
 ('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),
 ('sqlite3_exec',[P,c.c_char_p,P,P,P],c.c_int),
 ('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),
 ('sqlite3_step',[P],c.c_int),('sqlite3_reset',[P],c.c_int),
 ('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),
 ('sqlite3_column_type',[P,c.c_int],c.c_int),
 ('sqlite3_column_text',[P,c.c_int],P),('sqlite3_column_blob',[P,c.c_int],P),
 ('sqlite3_column_bytes',[P,c.c_int],c.c_int),
 ('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_extended_errcode',[P],c.c_int),
 ('sqlite3_sourceid',[],c.c_char_p),
 *[(f'sqlite3_column_{n}',[P,c.c_int],c.c_char_p) for n in ['name','decltype','database_name','table_name','origin_name']]]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
source=lib.sqlite3_sourceid().decode()
assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
root=pathlib.Path(__file__).parent
scalar=[r['sql'] for r in json.loads((root/'card-r-b-scalar-admission-native.json').read_text())['cases']]
raw_source=(root.parent.parent/'test/conformance/json-mergepatch-raw-label.test.mjs').read_text()
# Preserve original hardcoded expression inventory, including malformed controls.
raw=['SELECT '+s for s in re.findall(r'^ \["([^"]+)",',raw_source,re.M)]
assert len(scalar)==610 and len(raw)==23,(len(scalar),len(raw))
suites={'scalar':scalar,'raw':raw}
# SQL hex(TEXT) is database-encoding bytes; hex(JSONB) is unconverted binary.
# Companion SQL keeps raw bytes independently observable without JS decoding.
suites['scalarBytes']=['SELECT hex('+sql.removeprefix('SELECT ')+')' for sql in scalar]
out={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':{}}
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
 assert lib.sqlite3_exec(db,f"PRAGMA encoding='{pragma}'; CREATE TABLE encoding_anchor(x)".encode(),None,None,None)==0
 st=P();assert lib.sqlite3_prepare_v2(db,b'PRAGMA encoding',-1,c.byref(st),None)==0
 assert lib.sqlite3_step(st)==100
 assert c.string_at(lib.sqlite3_column_text(st,0)).decode().lower()==pragma.lower()
 assert lib.sqlite3_finalize(st)==0
 result={}
 for suite,sqls in suites.items():
  rows=[]
  for sql in sqls:
   stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
   meta={}
   for key,n in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    v=getattr(lib,'sqlite3_column_'+n)(stmt,0);meta[key]=v.decode() if v is not None else None
   assert all(meta[k] is None for k in ['declaredType','database','table','origin']),(sql,meta)
   def step():
    rc=lib.sqlite3_step(stmt)
    if rc!=100:
     assert rc==1,(sql,rc)
     return {'error':lib.sqlite3_errmsg(db).decode(),'code':rc,'extendedCode':lib.sqlite3_extended_errcode(db)}
    typ=lib.sqlite3_column_type(stmt,0)
    if typ==5:v=None
    else:
     ptr=(lib.sqlite3_column_blob if typ==4 else lib.sqlite3_column_text)(stmt,0)
     n=lib.sqlite3_column_bytes(stmt,0);b=c.string_at(ptr,n)
     v=b.hex().upper() if typ==4 else b.decode('utf-8')
    assert lib.sqlite3_step(stmt)==101,sql
    return {'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],'value':v}
   first=step();reset=lib.sqlite3_reset(stmt);assert reset==first.get('code',0),(sql,reset)
   assert step()==first,sql
   assert lib.sqlite3_finalize(stmt)==first.get('code',0),sql
   rows.append({'sql':sql,'name':meta['name'],'metadata':meta,**first})
  result[suite]=rows
 assert lib.sqlite3_close(db)==0
 out['encodings'][enc]=result
pathlib.Path(sys.argv[2]).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(source,out['librarySha256'],{e:{s:len(v) for s,v in r.items()} for e,r in out['encodings'].items()})
