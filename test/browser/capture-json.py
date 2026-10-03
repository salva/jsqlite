#!/usr/bin/env python3
"""Dev-only pinned native capture; never imported or invoked by browser runtime."""
import ctypes as C, json, pathlib, struct, sys
root=pathlib.Path(__file__).resolve().parents[2]
L=C.CDLL(sys.argv[1]); P=C.c_void_p
signatures=[('sqlite3_sourceid',[],C.c_char_p),('sqlite3_open_v2',[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),('sqlite3_close',[P],C.c_int),('sqlite3_prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),('sqlite3_step',[P],C.c_int),('sqlite3_finalize',[P],C.c_int),('sqlite3_column_count',[P],C.c_int),('sqlite3_column_name',[P,C.c_int],C.c_char_p),('sqlite3_column_decltype',[P,C.c_int],C.c_char_p),('sqlite3_column_type',[P,C.c_int],C.c_int),('sqlite3_column_int64',[P,C.c_int],C.c_longlong),('sqlite3_column_double',[P,C.c_int],C.c_double),('sqlite3_column_text',[P,C.c_int],P),('sqlite3_column_blob',[P,C.c_int],P),('sqlite3_column_bytes',[P,C.c_int],C.c_int)]
for n,a,r in signatures: f=getattr(L,n);f.argtypes=a;f.restype=r
manifest=json.load(open(root/'reference/sqlite/manifest.json'));assert L.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
spec=[{'id':'json-subtypes','sql':"SELECT json_valid('{a:1}'),json_valid('{a:1}',2),json_valid(NULL),json(NULL),jsonb(NULL),subtype(json('{}')),subtype(jsonb('{}'))",'provenance':{'owner':'src/json.c jsonValidFunc/jsonFunc/jsonReturnString','existingSuite':'test/conformance/json-foundation.test.mjs','credit':'source-branch companion, no additional upstream test credit'}}, {'id':'json-values','sql':"SELECT json_extract('{\"x\":1.5}', '$.x'), json_extract('{\"x\":null}', '$.x'), json('{a:1}'), jsonb('{}')",'provenance':{'owner':'src/json.c jsonExtractFunc/jsonReturnFromBlob/jsonbResult','credit':'typed source-branch discriminator'}}]
current=json.load(open(root/'test/fixtures/CURRENT.json'));db=P();assert L.sqlite3_open_v2(str(root/'test/fixtures/generations'/current['generationId']/'generated/empty.db').encode(),C.byref(db),1,None)==0
for c in spec:
 s=P();tail=C.c_char_p();assert L.sqlite3_prepare_v2(db,c['sql'].encode(),-1,C.byref(s),C.byref(tail))==0
 c['columns']=[{'name':L.sqlite3_column_name(s,i).decode(),'declaredType':None if L.sqlite3_column_decltype(s,i) is None else L.sqlite3_column_decltype(s,i).decode()} for i in range(L.sqlite3_column_count(s))];rows=[]
 while True:
  rc=L.sqlite3_step(s)
  if rc!=100:assert rc==101;break
  row=[]
  for i in range(L.sqlite3_column_count(s)):
   t=L.sqlite3_column_type(s,i)
   if t==5:v={'type':'null'}
   elif t==1:v={'type':'integer','value':str(L.sqlite3_column_int64(s,i))}
   elif t==2:v={'type':'real','ieee754be':struct.pack('>d',L.sqlite3_column_double(s,i)).hex()}
   else:
    n=L.sqlite3_column_bytes(s,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(s,i);b=C.string_at(p,n) if n else b'';v={'type':'blob','hex':b.hex()} if t==4 else {'type':'text','utf8Hex':b.hex()}
   row.append(v)
  rows.append(row)
 c['rows']=rows;assert L.sqlite3_finalize(s)==0
assert L.sqlite3_close(db)==0
print(json.dumps({'sourceId':manifest['sqliteSourceId'],'cases':spec},indent=2))
