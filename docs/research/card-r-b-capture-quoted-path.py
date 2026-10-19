"""Development-only pinned quoted-path oracle, raw bytes retained in SQL."""
import ctypes as c,json,pathlib,sys
l=c.CDLL(sys.argv[1]);P=c.c_void_p
for n,a,r in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(l,n);f.argtypes=a;f.restype=r
source=l.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
def text(s):return "CAST(x'"+s.encode('utf-8',errors='surrogatepass').hex()+"' AS TEXT)"
d=P();assert l.sqlite3_open(b':memory:',c.byref(d))==0
sqls=[]
for doc in ['{"a\\nb":7}','{"":7}','{"a\\\"b":7}','{"a\\\\b":7}','{"a\\u0062":7}',"{'a\\vb':7}",'{}']:
 for p in ['$."a\nb"','$."a\\nb"','$."a\\xb"','$.""','$."a\\\"b"','$."a\\\\b"','$."ab"','$."a\\u0062"','$."a\x01b"','$."a\\ud800"','$."a','$."a\\','$."a\nb".[','$.missing.[']:
  for binary in [False,True]:
   v=('jsonb('+text(doc)+')') if binary else text(doc)
   for f in ['json_extract','json_type','json_array_length','json_remove','json_set','json_replace','json_insert','jsonb_set','jsonb_remove']:
    expr=f+'('+v+','+text(p)+(' ,9' if f in ['json_set','json_replace','json_insert','jsonb_set'] else '')+')'
    sqls.append('SELECT '+('hex('+expr+')' if f.startswith('jsonb') else expr))
   sqls.append('SELECT count(*) FROM json_each('+v+','+text(p)+')')
   sqls.append('SELECT '+v+' ->> '+text(p))
rows=[]
for sql in sqls:
 s=P();assert l.sqlite3_prepare_v2(d,sql.encode(),-1,c.byref(s),None)==0,sql
 rc=l.sqlite3_step(s);row={'sql':sql}
 if rc==100:
  typ=l.sqlite3_column_type(s,0);v=l.sqlite3_column_text(s,0);row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=None if typ==5 else v.decode())
 else:row['error']=l.sqlite3_errmsg(d).decode()
 l.sqlite3_finalize(s);rows.append(row)
pathlib.Path('docs/research/card-r-b-quoted-path-native.json').write_text(json.dumps({'sourceId':source,'cases':rows},indent=2)+'\n');print(len(rows),'pinned cases')
