"""Pinned development-only scalar admission/coercion oracle."""
import ctypes as c
import json,pathlib,sys
lib=c.CDLL(sys.argv[1]);P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
source=lib.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
sqls=[]
for f in ['json_type','json_array_length']:
 for doc in ['NULL',"'bad'","'{}'","'[1,2]'","'1'","'1.0'","'null'","jsonb('[1,2]')","x'00'","x'cb02'",'1','1.0']:
  sqls.append(f'SELECT {f}({doc})')
  for path in ['NULL','1','1.0',"x'31'","x'24'","'$'","'$.missing'","'$[#-1]'","'$[-1]'","'$[999].['","'$['","CAST(x'24006a756e6b' AS TEXT)"]:
   sqls.append(f'SELECT {f}({doc},{path})')
for f in ['json_set','json_insert','json_replace','json_array_insert','jsonb_set','jsonb_insert','jsonb_replace','jsonb_array_insert','json_remove','jsonb_remove']:
 for doc in ["'bad'",'NULL',"'{}'","'[1,2]'"]:
  for p in ['NULL','1','1.0',"x'31'","x'242e61'","'$.a'","CAST(x'240078' AS TEXT)"]:
   tail='' if f.endswith('remove') else ',3'
   expr=f'{f}({doc},{p}{tail})'
   sqls.append('SELECT '+('hex('+expr+')' if f.startswith('jsonb') else expr))
for f in ['json_valid','json_error_position']:
 for doc in ['NULL','1','1.0','-1','1e100',"'bad'","'[]'","x'5b5d'","x'00'"]:
  sqls.append(f'SELECT {f}({doc})')
rows=[];db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
for sql in sqls:
 stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
 rc=lib.sqlite3_step(stmt);row={'sql':sql}
 if rc==100:
  typ=lib.sqlite3_column_type(stmt,0);raw=lib.sqlite3_column_text(stmt,0)
  row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=None if typ==5 else raw.decode())
 else:row.update(error=lib.sqlite3_errmsg(db).decode())
 lib.sqlite3_finalize(stmt);rows.append(row)
lib.sqlite3_close(db)
pathlib.Path('docs/research/card-r-b-scalar-admission-native.json').write_text(json.dumps({'sourceId':source,'cases':rows},indent=2)+'\n')
print(source);print(len(rows),'typed scalar admission cases')
