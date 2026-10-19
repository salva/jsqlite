"""Development-only typed JSON numeric capture, pinned SQLite 3.53.4."""
import ctypes as c
import json,pathlib,sys
lib=c.CDLL(sys.argv[1]);P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_double',[P,c.c_int],c.c_double),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_blob',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
source=lib.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
def blob(t,s):
 b=s.encode();return bytes([(len(b)<<4)|t])+b if len(b)<12 else bytes([0xc0|t,len(b)])+b
def lit(b):return "x'"+b.hex()+"'"
sqls=[]
for t in [3,4,5,6]:
 for raw in ['1','-0','1.0','1e0','+1','.5','1.','0x10','-0x8000000000000000','0xffffffffffffffff','9223372036854775807','9223372036854775808','-9223372036854775808','-9223372036854775809','1e999','1e-999','bad','']:
  b=blob(t,raw);doc=lit(b)
  for expr in [f"json_extract({doc},'$')",f"jsonb_extract({doc},'$')",f"{doc} ->> '$'",f"json_type({doc})",f"json({doc})",f"hex(jsonb({doc}))"]:sqls.append('SELECT '+expr)
for raw in ['1','1.0','1e0','+1','-0','-0.0','0x10','-0x8000000000000000','0xffffffffffffffff','1e999','NaN','Infinity','.5','1.']:
 for expr in [f"json_extract('{raw}','$')",f"json_type('{raw}')",f"hex(jsonb('{raw}'))"]:sqls.append('SELECT '+expr)
children=b''.join(blob(t,s) for t,s in [(3,'1'),(4,'0x10'),(5,'1'),(6,'-0')]);doc=lit(bytes([0xcb,len(children)])+children)
for i in range(4):
 for expr in [f"json_extract({doc},'$[{i}]')",f"jsonb_extract({doc},'$[{i}]')",f"{doc} ->> {i}",f"json_type({doc},'$[{i}]')",f"typeof(json_extract({doc},'$[{i}]'))",f"json_array(json_extract({doc},'$[{i}]'))",f"json_extract({doc},'$[{i}]')+0.0"]:sqls.append('SELECT '+expr)
for expr in [f"hex(jsonb_extract({doc},'$','$'))",f"json_extract({doc},'$','$')",f"sum(json_extract({doc},'$[2]'))",f"json_group_array(json_extract({doc},'$[2]'))"]:sqls.append('SELECT '+expr)
rows=[];db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
for sql in sqls:
 stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
 rc=lib.sqlite3_step(stmt);row={'sql':sql}
 if rc==100:
  typ=lib.sqlite3_column_type(stmt,0);raw=lib.sqlite3_column_text(stmt,0)
  if typ==2: row['realHex']=lib.sqlite3_column_double(stmt,0).hex()
  row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=None if typ==5 else c.string_at(lib.sqlite3_column_blob(stmt,0),lib.sqlite3_column_bytes(stmt,0)).hex().upper() if typ==4 else raw.decode())
 else:row.update(error=lib.sqlite3_errmsg(db).decode())
 lib.sqlite3_finalize(stmt);rows.append(row)
lib.sqlite3_close(db)
pathlib.Path('docs/research/card-r-b-numeric-native.json').write_text(json.dumps({'sourceId':source,'cases':rows},indent=2)+'\n')
print(source);print(len(rows),'typed numeric cases')
