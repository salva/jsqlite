"""Development-only capture; pass the pinned oracle .so path as argv[1]."""
import ctypes as c
import json
import pathlib
import sys
lib=c.CDLL(sys.argv[1]);P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
sqls=[]
def lit(s):return "'"+s.replace("'","''")+"'"
pairs=[
 ('{"a":1,"a":2}','{"a":null}'),
 ('{"a":1,"a":2}','{"a":9}'),
 ('{"a":1,"a":2}','{"a":null,"a":null}'),
 ('{"z":0,"a":1,"m":3,"a":2,"q":4}','{"a":null}'),
 ('{"a":null,"a":2,"a":3}','{"a":null,"a":null}'),
 ('{"a":{"k":1,"k":2},"a":3}','{"a":{"k":null}}'),
 ('{"a":1,"a":2}','{"a":{"k":null,"k":3}}'),
 ('{"a":1,"a":2}','{"a":null,"a":9}'),
 ('{"a":1,"a":2}','{"a":9,"a":null}'),
 ('{"a":1,"a":2}','{"missing":null,"b":4}'),
 ('[]','{"a":null,"a":2}'),('null','{"a":null}'),
 ('{"a":1,"a":2}','[1,2]'),('{"a":1,"a":2}','null'),
 ('{"a":1,"a":2}','{}'),
]
for t,p in pairs:
 t,p=lit(t),lit(p)
 for a,b in [(t,p),(f'jsonb({t})',p),(t,f'jsonb({p})'),(f'jsonb({t})',f'jsonb({p})')]:
  sqls.extend([f'json_patch({a},{b})',f'hex(jsonb_patch({a},{b}))',f'typeof(jsonb_patch({a},{b}))'])
sqls.extend(["json_patch(json_patch('{\"a\":1,\"a\":2}','{\"a\":null}'),'{\"a\":null}')",
 "json_patch(NULL,'{}')","json_patch('{}',NULL)","json_patch('bad','{}')","json_patch('{}','bad')", "jsonb_patch(x'FF','{}')"])
# Source-derived branches: raw label spelling/header preservation, superficial
# malformed JSONB replaced without descent, and recursion guard at 1000.
sqls.extend(["json_patch('bad',NULL)","jsonb_patch('bad',NULL)","json_patch(NULL,'bad')"])
for t,p in [(r'{"\u0061":1,"b":2}',r'{"a":9}'),('{}',r'{"\u0061":2}'),('1','{}')]:
 sqls.extend([f'json_patch({lit(t)},{lit(p)})',f'hex(jsonb_patch({lit(t)},{lit(p)}))'])
for t,p in [("x'2C1761'","'0'"),("'{}'","x'2C1761'"),("x'2C1761'","'{}'"),("'{}'","x'1BFF'"),("x'1BFF'","'0'"),("x'CC0417611331'","'{\"a\":2}'")]:
 sqls.extend([f'hex(jsonb_patch({t},{p}))',f'json_patch({t},{p})'])
for depth in [999,1000]:
 doc='{"a":'*depth+'0'+'}'*depth
 for patch in [doc,'{"a":'*depth+'{}'+'}'*depth]:
  sqls.append(f'length(json_patch({lit(doc)},{lit(patch)}))')
db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
rows=[]
for q in dict.fromkeys(sqls):
 s=P();rc=lib.sqlite3_prepare_v2(db,('SELECT '+q).encode(),-1,c.byref(s),None)
 if rc==0:rc=lib.sqlite3_step(s)
 r={'expression':q,'rc':rc}
 if rc==100:
  r['type']=lib.sqlite3_column_type(s,0);v=lib.sqlite3_column_text(s,0);r['value']=v.decode() if v is not None else None
 else:r['error']=lib.sqlite3_errmsg(db).decode()
 rows.append(r);lib.sqlite3_finalize(s)
lib.sqlite3_close(db)
result={'sourceId':lib.sqlite3_sourceid().decode(),'cases':rows}
pathlib.Path(__file__).with_name('card-r-b-mergepatch-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['sourceId'],len(rows),'cases')
