import ctypes as c, json, sys, hashlib
from pathlib import Path
lib=c.CDLL(sys.argv[1]);lib.sqlite3_libversion.restype=c.c_char_p;lib.sqlite3_sourceid.restype=c.c_char_p
assert lib.sqlite3_libversion().decode()=='3.53.4'
assert lib.sqlite3_sourceid().decode()=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
for name in ['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name','sqlite3_errmsg']:
 getattr(lib,name).restype=c.c_char_p
lib.sqlite3_column_int64.restype=c.c_longlong;lib.sqlite3_column_double.restype=c.c_double
root=Path(__file__).parent;cases=[]
for sql in json.loads((root/'sql.json').read_text()):
 db=c.c_void_p();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
 assert lib.sqlite3_exec(db,b'CREATE TABLE t1(a INTEGER); INSERT INTO t1 VALUES(1),(3),(5),(7);',None,None,None)==0
 st=c.c_void_p();rc=lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(st),None);entry={'sql':sql,'prepare':rc,'columns':[],'rows':[]}
 if rc==0:
  n=lib.sqlite3_column_count(st)
  for i in range(n):
   col={}
   for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
    v=getattr(lib,'sqlite3_column_'+fn)(st,i);col[key]=v.decode() if v else None
   entry['columns'].append(col)
  while True:
   step=lib.sqlite3_step(st)
   if step!=100:break
   row=[]
   for i in range(n):
    t=lib.sqlite3_column_type(st,i);assert t in [1,2,5]
    row.append({'type':{1:'integer',2:'real',5:'null'}[t],'value':lib.sqlite3_column_int64(st,i) if t==1 else lib.sqlite3_column_double(st,i) if t==2 else None})
   entry['rows'].append(row)
  entry['step']=step;entry['error']=None if step==101 else lib.sqlite3_errmsg(db).decode()
 else:entry['error']=lib.sqlite3_errmsg(db).decode()
 lib.sqlite3_finalize(st);lib.sqlite3_close(db);cases.append(entry)
print(json.dumps({'version':lib.sqlite3_libversion().decode(),'sourceid':lib.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'cases':cases},indent=2))
