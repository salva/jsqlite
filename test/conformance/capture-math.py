#!/usr/bin/env python3
"""Capture typed ordinary-math observations from the manifest-pinned native oracle."""
import argparse, ctypes as C, hashlib, json, pathlib, struct
ROOT=pathlib.Path(__file__).resolve().parents[2]; P=C.c_void_p
ap=argparse.ArgumentParser(); ap.add_argument('--library',required=True); ap.add_argument('--output',default=str(ROOT/'test/conformance/cases/stage3-math.native.json')); ns=ap.parse_args()
spec_path=ROOT/'test/conformance/cases/stage3-math.spec.json'; spec=json.loads(spec_path.read_text()); L=C.CDLL(ns.library)
sigs={'sqlite3_sourceid':([],C.c_char_p),'sqlite3_libversion':([],C.c_char_p),'sqlite3_open':([C.c_char_p,C.POINTER(P)],C.c_int),'sqlite3_close':([P],C.c_int),'sqlite3_exec':([P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),'sqlite3_step':([P],C.c_int),'sqlite3_finalize':([P],C.c_int),'sqlite3_errmsg':([P],C.c_char_p),'sqlite3_column_count':([P],C.c_int),'sqlite3_column_type':([P,C.c_int],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong),'sqlite3_column_double':([P,C.c_int],C.c_double),'sqlite3_column_text':([P,C.c_int],P),'sqlite3_column_bytes':([P,C.c_int],C.c_int),'sqlite3_bind_int64':([P,C.c_int,C.c_longlong],C.c_int),'sqlite3_bind_double':([P,C.c_int,C.c_double],C.c_int),'sqlite3_bind_null':([P,C.c_int],C.c_int),'sqlite3_bind_text':([P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),'sqlite3_bind_blob':([P,C.c_int,P,C.c_int,P],C.c_int),'sqlite3_compileoption_used':([C.c_char_p],C.c_int)}
for n,(a,r) in sigs.items(): f=getattr(L,n); f.argtypes=a; f.restype=r
source=L.sqlite3_sourceid().decode(); assert source==spec['source']['sourceId']; SQLITE_TRANSIENT=P(-1)
def value(st,i):
 t=L.sqlite3_column_type(st,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(L.sqlite3_column_int64(st,i))}
 if t==2:
  x=L.sqlite3_column_double(st,i); bits=struct.pack('>d',x).hex()
  return {'type':'real','ieee754Hex':bits,'hexFloat':x.hex()}
 n=L.sqlite3_column_bytes(st,i); p=L.sqlite3_column_text(st,i); b=C.string_at(p,n) if p else b''
 return {'type':'text','utf8Hex':b.hex(),'value':b.decode('utf-8','replace')}
def bind(st,p):
 i=p['index']; typ=p['type']
 if typ=='null': rc=L.sqlite3_bind_null(st,i)
 elif typ=='integer': rc=L.sqlite3_bind_int64(st,i,int(p['value']))
 elif typ=='real': rc=L.sqlite3_bind_double(st,i,float(p['value']))
 elif typ=='text':
  b=p['value'].encode(); rc=L.sqlite3_bind_text(st,i,b,len(b),SQLITE_TRANSIENT)
 elif typ=='blob':
  b=bytes.fromhex(p['hex']); buf=C.create_string_buffer(b); rc=L.sqlite3_bind_blob(st,i,buf,len(b),SQLITE_TRANSIENT)
 else: raise AssertionError(typ)
 assert rc==0
fixtures={'UTF-8':'users-utf8.db','UTF-16le':'users-utf16le.db','UTF-16be':'users-utf16be.db'}; obs=[]
for case in spec['cases']:
 for enc in case['encodings']:
  db=P(); target=b':memory:' if case['database']=='memory' else str(ROOT/'test/fixtures/expression-cursor'/fixtures[enc]).encode(); assert L.sqlite3_open(target,C.byref(db))==0
  if case['database']=='memory': err=C.c_char_p(); assert L.sqlite3_exec(db,f"PRAGMA encoding='{enc}'".encode(),None,None,C.byref(err))==0
  st=P(); tail=C.c_char_p(); rc=L.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(st),C.byref(tail)); assert rc==0,(case['id'],L.sqlite3_errmsg(db))
  for p in case['parameters']: bind(st,p)
  rows=[]
  while True:
   rc=L.sqlite3_step(st)
   if rc==100: rows.append([value(st,i) for i in range(L.sqlite3_column_count(st))])
   else: assert rc==101,(case['id'],rc,L.sqlite3_errmsg(db)); break
  L.sqlite3_finalize(st); L.sqlite3_close(db); obs.append({'id':case['id'],'encoding':enc,'sql':case['sql'],'parameters':case['parameters'],'rows':rows})
profile={'compileOptions':spec['profile']['mandatoryCompileOptions'],'c99MathFunctions':all(any(r['name']==n for r in spec['registry']) for n in spec['profile']['c99ConditionalRows']),'compileOptionUsed':{x:bool(L.sqlite3_compileoption_used(x.encode())) for x in spec['profile']['mandatoryCompileOptions']}}
out={'schemaVersion':1,'kind':'native-reference-only-no-ts-credit','source':{'version':L.sqlite3_libversion().decode(),'sourceId':source,'manifest':'reference/sqlite/manifest.json','manifestSha256':hashlib.sha256((ROOT/'reference/sqlite/manifest.json').read_bytes()).hexdigest(),'specSha256':hashlib.sha256(spec_path.read_bytes()).hexdigest()},'profile':profile,'counts':{'registryRows':len(spec['registry']),'distinctNames':spec['scope']['distinctNames'],'selectedCases':len(spec['cases']),'observations':len(obs),'tsCredit':0},'observations':obs}
pathlib.Path(ns.output).write_text(json.dumps(out,indent=2)+'\n'); print(json.dumps(out['counts'],sort_keys=True))
