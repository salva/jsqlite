#!/usr/bin/env python3
"""Development-only pinned native argument admission receipts and carrier fixtures."""
import ctypes as C,json,pathlib,sys
L=C.CDLL(sys.argv[1]);P=C.c_void_p
signatures=[('sqlite3_open',[C.c_char_p,C.POINTER(P)],C.c_int),('sqlite3_exec',[P,C.c_char_p,P,P,P],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_sourceid',[],C.c_char_p),('sqlite3_bind_text',[P,C.c_int,P,C.c_int,P],C.c_int),('sqlite3_bind_blob',[P,C.c_int,P,C.c_int,P],C.c_int)]
for n,a,r in signatures:f=getattr(L,n);f.argtypes=a;f.restype=r
identity=L.sqlite3_sourceid().decode();assert identity=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
root=pathlib.Path(sys.argv[2]);root.mkdir(parents=True,exist_ok=True);receipts=[]
queries=["SELECT strftime('%Y'||char(0)||'%m','2000-01-02')", "SELECT date('2000-01-02'||char(0)||'junk')", "SELECT strftime(NULL,'now')", "SELECT date(x'323030302d30312d3031')", "SELECT date(CAST('2000-01-02' AS BLOB))", "SELECT strftime(CAST('%Y' AS BLOB),'2000-01-02')", "SELECT date(b),date(t),strftime(f,t),typeof(b),hex(b) FROM carrier", "SELECT date(CAST(20000102.0 AS TEXT)),strftime(1.0,'2000-01-02')"]
for mod in ['+1 day','start of month','+01:00','subsec','weekday 2','unixepoch','auto']:
 queries.append("SELECT datetime("+('0' if mod in ['unixepoch','auto'] else "'2000-01-01'")+",'"+mod+"'||char(0)||'junk')")
for value in ['1e300','-1e300','1e999','-1e999',"'1e300'","'-1e300'",'5373484.5','5373484.499999','-0.000000001','0','253402300799','253402300800','-210866760000','-210866760001']:
 queries.append(f"SELECT julianday({value}),datetime({value},'unixepoch'),datetime({value},'auto')")
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(enc+'.db');p.unlink(missing_ok=True);db=P();assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
 def execute(q):assert L.sqlite3_exec(db,q.encode(),None,None,None)==0,q
 execute(f"PRAGMA encoding='{enc}'");execute("CREATE TABLE carrier(t TEXT,b BLOB,f TEXT)");execute("INSERT INTO carrier VALUES('2000-01-02',CAST('2000-01-02' AS BLOB),'%Y'||char(0)||'%m')")
 execute("CREATE TABLE rawfirst(a TEXT,g TEXT AS (timediff(1e300,a)) VIRTUAL)");execute("INSERT INTO rawfirst(a) VALUES('now')")
 for table,first in [('textfirst',"'1e300'"),('nullfirst','NULL')]:
  execute(f"CREATE TABLE {table}(a TEXT,g TEXT AS (timediff({first},a)) VIRTUAL)");execute(f"INSERT INTO {table}(a) VALUES('now')")
 execute("CREATE TABLE validfirst(a TEXT);INSERT INTO validfirst VALUES('now');PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='CREATE TABLE validfirst(a TEXT,g TEXT AS (timediff(''2000-01-01'',a)) VIRTUAL)' WHERE name='validfirst';PRAGMA writable_schema=OFF")
 L.sqlite3_close(db);assert L.sqlite3_open(str(p).encode(),C.byref(db))==0
 cases=[(q,None) for q in queries]+[(f"SELECT g,typeof(g) FROM {table}",None) for table in ['rawfirst','textfirst','nullfirst','validfirst']]+[(f"SELECT timediff({first},?1),typeof(timediff({first},?1))",[{'kind':'text','hex':b'now'.hex()}]) for first in ['1e300',"'1e300'",'NULL',"'invalid'"]]+[("SELECT date(?1),strftime(?2,?1)",[{'kind':'text','hex':b'2000-01-02\0junk'.hex()},{'kind':'text','hex':b'%Y\0%m'.hex()}]),("SELECT date(?1)",[{'kind':'blob','hex':b'2000-01-02'.hex()}])]
 for q,params in cases:
  st=P();assert L.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None)==0;buffers=[]
  for i,param in enumerate(params or [],1):
   raw=bytes.fromhex(param['hex']);buf=C.create_string_buffer(raw);buffers.append(buf);f=L.sqlite3_bind_text if param['kind']=='text' else L.sqlite3_bind_blob;assert f(st,i,buf,len(raw),None)==0
  rc=L.sqlite3_step(st)
  if 'FROM validfirst' in q:
   assert rc==1,(q,rc)
   L.sqlite3_finalize(st);receipts.append({'encoding':enc,'sql':q,'params':params,'error':1});continue
  assert rc==100,q;row=[]
  for i in range(L.sqlite3_column_count(st)):
   t=L.sqlite3_column_type(st,i);cell={'type':{1:'integer',2:'real',3:'text',4:'blob',5:'null'}[t]}
   if t==3:
    ptr=L.sqlite3_column_text(st,i);n=L.sqlite3_column_bytes(st,i);cell['hex']=C.string_at(ptr,n).hex()
   elif t==1:cell['value']=str(L.sqlite3_column_int64(st,i))
   elif t==2:cell['value']=L.sqlite3_column_double(st,i).hex()
   row.append(cell)
  assert L.sqlite3_step(st)==101;L.sqlite3_finalize(st);receipts.append({'encoding':enc,'sql':q,'params':params,'row':row})
 L.sqlite3_close(db)
(root/'native.json').write_text(json.dumps({'sourceId':identity,'observations':receipts},indent=2)+'\n');print(identity);print(len(receipts),'typed native observations; zero corpus credit')
