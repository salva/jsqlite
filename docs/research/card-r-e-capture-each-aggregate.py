"""Development-only pinned each-to-aggregate lifecycle oracle; no host sqlite fallback.
Source cases: json103.test aggregates; json.c json*Step/Compute/jsonGroupInverse.
Run: python3 this.py /absolute/pinned/libsqlite3-oracle.so output.json
"""
import ctypes as c, hashlib, json, pathlib, sys
lib=pathlib.Path(sys.argv[1]); l=c.CDLL(str(lib)); P=c.c_void_p
spec=[('sqlite3_sourceid',[],c.c_char_p),('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_exec',[P,c.c_char_p,P,P,P],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_bind_int64',[P,c.c_int,c.c_int64],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_count',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_int64',[P,c.c_int],c.c_int64),('sqlite3_column_double',[P,c.c_int],c.c_double),('sqlite3_column_text',[P,c.c_int],P),('sqlite3_column_blob',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_reset',[P],c.c_int),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int)]
for name in ['name','decltype','database_name','table_name','origin_name']:spec.append(('sqlite3_column_'+name,[P,c.c_int],c.c_char_p))
for n,a,r in spec:f=getattr(l,n);f.argtypes=a;f.restype=r
source=l.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
assert hashlib.sha256(lib.read_bytes()).hexdigest()=='b74284142511a672e841ef5c370cab35f2d873912082319831759459bba05347'
base=''
value="CASE n%4 WHEN 0 THEN NULL WHEN 1 THEN 2.5 WHEN 2 THEN 9223372036854775807 ELSE 'text' END"
# Positions 0,3,6 are NULL labels, including an ignored ordinary malformed BLOB.
label="CASE WHEN n%3=0 THEN NULL ELSE 'dup' END"
objvalue=f"CASE WHEN n%3=0 THEN X'FF' ELSE {value} END"
queries=[]
for mode in ['grouped','sliding']:
 suffix='' if mode=='grouped' else ' OVER (ORDER BY n ROWS 2 PRECEDING)'
 columns=[f'json_group_array(json_array({value})){suffix} AS a',f'jsonb_group_array(jsonb(json_array({value}))){suffix} AS b',f'json_group_object({label},{objvalue}){suffix} AS o',f'jsonb_group_object({label},{objvalue}){suffix} AS p']
 if mode=='grouped':
  columns=[col.replace(')) AS',') ORDER BY n) AS') if 'group_array' in col else col.replace(') AS',' ORDER BY n) AS') for col in columns]
 select=('n%2 AS g,' if mode=='grouped' else 'n,')+','.join(columns)
 end=' GROUP BY n%2 ORDER BY n%2' if mode=='grouped' else ' ORDER BY n'
 queries.append(dict(id=mode,sql=base+'SELECT '+select+' FROM t WHERE n<?1'+end,bindings=[7,4]))
queries.append(dict(id='empty',sql=base+'SELECT json_group_array(n) AS a,jsonb_group_array(n) AS b,json_group_object(n,n) AS o,jsonb_group_object(n,n) AS p FROM t WHERE n<?1',bindings=[0,0]))
for fun in ['json_group_array','jsonb_group_array','json_group_object','jsonb_group_object']:
 arg="CASE WHEN ?1=0 THEN X'FF' ELSE 1 END"
 if fun.endswith('object'):arg="'key',"+arg
 queries.append(dict(id=fun+'-error',sql='SELECT '+fun+'('+arg+') AS result',bindings=[0,1]))
# NULL label suppresses aggregate admission, not SQL argument evaluation.
queries.append(dict(id='argument-error',sql="SELECT json_group_object(NULL,json(CASE WHEN ?1=0 THEN 'bad' ELSE 'null' END)) AS result",bindings=[0,1]))
import re
for q in queries:q['sql']=re.sub(r'\bn\b','x',q['sql']).replace(' FROM t ', ' FROM t1 ')
# Keep the physical-source comparator untouched. These exact statements also
# exercise executed jsonEachColumn reads feeding grouped/sliding aggregates.
queries=[dict(q,sql=re.sub(r'\bx\b','value',q['sql']).replace('FROM t1',"FROM json_each('[0,1,2,3,4,5,6]')")) for q in queries]
original=list(queries)
# Error/recovery also enters the each cursor; keep one input row so an error
# is raised by aggregate admission (or argument evaluation), not by row count.
for q in original:
 if q['id'].endswith('-error'):
  q['sql']+=" FROM json_each('[0,1,2,3,4,5,6]') WHERE value<1"
for real in ['1e-7','1e20']:
 for q in original:
  if q['id'] in ['grouped','sliding']:
   queries.append(dict(q,id=q['id']+'-'+real,sql=q['sql'].replace('THEN 2.5','THEN '+real)))
rows=[]
for enc in ['utf8','utf16le','utf16be']:
 db=P();assert l.sqlite3_open(b':memory:',c.byref(db))==0
 pragma={'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc]
 assert l.sqlite3_exec(db,("PRAGMA encoding='"+pragma+"'").encode(),None,None,None)==0
 for q in queries:
  s=P();assert l.sqlite3_prepare_v2(db,q['sql'].encode(),-1,c.byref(s),None)==0
  count=l.sqlite3_column_count(s)
  meta=[{n:(getattr(l,'sqlite3_column_'+n)(s,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']} for i in range(count)]
  executions=[]
  for binding in q['bindings']:
   assert l.sqlite3_bind_int64(s,1,binding)==0
   result=[]
   while True:
    rc=l.sqlite3_step(s)
    if rc!=100:break
    row=[]
    for i in range(count):
     typ=l.sqlite3_column_type(s,i);value=None
     if typ==1:value=str(l.sqlite3_column_int64(s,i))
     elif typ==2:value=l.sqlite3_column_double(s,i)
     elif typ in [3,4]:
      ptr=(l.sqlite3_column_text if typ==3 else l.sqlite3_column_blob)(s,i)
      raw=c.string_at(ptr,l.sqlite3_column_bytes(s,i));value=raw.decode() if typ==3 else raw.hex()
     row.append(dict(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=value))
    result.append(row)
   error=None if rc==101 else dict(code=rc,message=l.sqlite3_errmsg(db).decode())
   reset=l.sqlite3_reset(s);assert reset==(0 if error is None else error['code'])
   executions.append(dict(binding=binding,rows=result,error=error))
  assert l.sqlite3_finalize(s)==0
  rows.append(dict(enc=enc,**q,metadata=meta,executions=executions))
 assert l.sqlite3_close(db)==0
out=dict(source=source,library_sha256=hashlib.sha256(lib.read_bytes()).hexdigest(),provenance='Derived from card-r-e physical aggregate matrix; json103.test + jsonEachColumn and json*Step/Compute/Inverse exact composition, including REAL2.5/1e-7/1e20 (not verbatim upstream SQL)',rows=rows)
pathlib.Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n');print('captured',len(rows),'statements;',sum(len(r['executions']) for r in rows),'executions')
