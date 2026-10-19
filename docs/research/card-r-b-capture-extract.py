"""Development-only extraction capture against pinned SQLite; no product import."""
import ctypes as c
import json
import pathlib
import sys
lib=c.CDLL(sys.argv[1]);P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_blob',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
source=lib.sqlite3_sourceid().decode()
assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
sqls=[]
for fn in ['json_extract','jsonb_extract']:
 for doc in ["'bad'","'{}'","'[1]'",'NULL',"jsonb('{}')"]:
  for args in ['NULL',"'$[',NULL","NULL,'$['",'1','9223372036854775807','-9223372036854775808','1.25',"x'24'","x'31'","'$.x',NULL","'bad',NULL","NULL,'bad'"]:
   sqls.append(f'SELECT {fn}({doc},{args})')
 for doc in ["'{\"a\":[1],\"b\":1.0,\"c\":null}'","jsonb('{\"a\":[1],\"b\":1.0,\"c\":null}')"]:
  for args in ["'$.a'","'$.b'","'$.c'","'$.z'","'$.a','$.b','$.z'","'$','$.a'","'$.a[0].',NULL","NULL,'$.a[0].'"]:
   # hex exposes exact BLOB bytes without adapter normalization.
   expr=f'{fn}({doc},{args})'
   sqls.extend([f'SELECT {expr}',f'SELECT json_array({expr})'])
rows=[];db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
for sql in sqls:
 stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
 rc=lib.sqlite3_step(stmt);row={'sql':sql}
 if rc==100:
  typ=lib.sqlite3_column_type(stmt,0);raw=lib.sqlite3_column_text(stmt,0)
  row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=None if typ==5 else c.string_at(lib.sqlite3_column_blob(stmt,0),lib.sqlite3_column_bytes(stmt,0)).hex().upper() if typ==4 else raw.decode())
 else:row.update(error=lib.sqlite3_errmsg(db).decode())
 lib.sqlite3_finalize(stmt);rows.append(row)
lib.sqlite3_close(db)
pathlib.Path('docs/research/card-r-b-extract-native.json').write_text(json.dumps({'sourceId':source,'cases':rows},indent=2)+'\n')
print(source);print(len(rows),'typed extraction cases')
