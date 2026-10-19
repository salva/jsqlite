"""Development-only pinned arrow oracle capture; never imported by product."""
import ctypes as c
import json
import pathlib
import sys
lib=c.CDLL(sys.argv[1]); P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name); f.argtypes=args; f.restype=ret
source=lib.sqlite3_sourceid().decode()
assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
pairs=[("'[11,22]'",p) for p in ['-1','0','1','-2','-3','9223372036854775807','-9223372036854775808','1.0','NULL',"'1'","'[1]'","'$[1]'","'$['","'[#-1]'","'[x]'", "x'31'"]]
pairs += [("'{\"a.b\":7,\"1\":9,\"1.0\":8,\"a_b\":6,\"\":5}'",p) for p in ["'a.b'","'1'","1","1.0","'a_b'","''","'\"a.b\"'","'$'","'$.a.b'","'$.\"a.b\"'"]]
pairs += [("'bad'",'NULL'),('NULL',"'$['"),("'{}'","'$['"),("'[1]'","'$['")]
rows=[];db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
for doc,path in pairs:
 for op in ['->','->>']:
  for document in [doc,'jsonb('+doc+')']:
   sql=f'SELECT {document} {op} {path}'
   stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
   rc=lib.sqlite3_step(stmt);row={'sql':sql}
   if rc==100:
    typ=lib.sqlite3_column_type(stmt,0);raw=lib.sqlite3_column_text(stmt,0)
    row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=None if typ==5 else raw.decode())
   else:row.update(error=lib.sqlite3_errmsg(db).decode())
   lib.sqlite3_finalize(stmt);rows.append(row)
# Subtype consumption distinguishes JSON text from ordinary SQL TEXT.
for op in ['->','->>']:
 sql=f"SELECT json_array('{{\"a\":[1]}}' {op} 'a')";stmt=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0
 assert lib.sqlite3_step(stmt)==100;rows.append({'sql':sql,'type':'text','value':lib.sqlite3_column_text(stmt,0).decode()});lib.sqlite3_finalize(stmt)
lib.sqlite3_close(db)
pathlib.Path('docs/research/card-r-b-arrow-native.json').write_text(json.dumps({'sourceId':source,'cases':rows},indent=2)+'\n')
print(source);print(len(rows),'typed native cases captured')
