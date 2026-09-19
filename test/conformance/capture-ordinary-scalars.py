#!/usr/bin/env python3
"""Capture immutable typed ordinary-scalar outcomes from the manifest-pinned oracle."""
import argparse,ctypes as C,hashlib,json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]; P=C.c_void_p
ap=argparse.ArgumentParser();ap.add_argument('--library',required=True);ap.add_argument('--output',default=str(ROOT/'test/conformance/cases/stage3-ordinary-scalars.native.json'));ns=ap.parse_args()
spec_path=ROOT/'test/conformance/cases/stage3-ordinary-scalars.spec.json';spec=json.loads(spec_path.read_text());L=C.CDLL(ns.library)
sigs={'sqlite3_sourceid':([],C.c_char_p),'sqlite3_libversion':([],C.c_char_p),'sqlite3_compileoption_get':([C.c_int],C.c_char_p),'sqlite3_open':([C.c_char_p,C.POINTER(P)],C.c_int),'sqlite3_close':([P],C.c_int),'sqlite3_exec':([P,C.c_char_p,P,P,C.POINTER(C.c_char_p)],C.c_int),'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),'sqlite3_step':([P],C.c_int),'sqlite3_finalize':([P],C.c_int),'sqlite3_errmsg':([P],C.c_char_p),'sqlite3_extended_errcode':([P],C.c_int),'sqlite3_column_count':([P],C.c_int),'sqlite3_column_name':([P,C.c_int],C.c_char_p),'sqlite3_column_type':([P,C.c_int],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong),'sqlite3_column_double':([P,C.c_int],C.c_double),'sqlite3_column_text':([P,C.c_int],P),'sqlite3_column_blob':([P,C.c_int],P),'sqlite3_column_bytes':([P,C.c_int],C.c_int),'sqlite3_bind_null':([P,C.c_int],C.c_int),'sqlite3_bind_int64':([P,C.c_int,C.c_longlong],C.c_int),'sqlite3_bind_double':([P,C.c_int,C.c_double],C.c_int),'sqlite3_bind_text':([P,C.c_int,C.c_char_p,C.c_int,P],C.c_int),'sqlite3_bind_blob':([P,C.c_int,P,C.c_int,P],C.c_int)}
for n,(a,r) in sigs.items():f=getattr(L,n);f.argtypes=a;f.restype=r
source=L.sqlite3_sourceid().decode();assert source==spec['source']['sourceId']; TRANSIENT=P(-1)
def err(db,phase,rc):return {'phase':phase,'resultCode':rc,'primaryCode':rc&255,'extendedCode':L.sqlite3_extended_errcode(db),'message':L.sqlite3_errmsg(db).decode()}
def value(st,i):
 t=L.sqlite3_column_type(st,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(L.sqlite3_column_int64(st,i))}
 if t==2:
  x=L.sqlite3_column_double(st,i);return {'type':'real','value':x.hex()}
 n=L.sqlite3_column_bytes(st,i);p=(L.sqlite3_column_blob if t==4 else L.sqlite3_column_text)(st,i);raw=C.string_at(p,n) if p else b''
 return {'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex(),'value':raw.decode('utf-8','replace')}
def bind(st,p):
 i=p['index'];t=p['type']
 if t=='null':rc=L.sqlite3_bind_null(st,i)
 elif t=='integer':rc=L.sqlite3_bind_int64(st,i,int(p['value']))
 elif t=='real':rc=L.sqlite3_bind_double(st,i,float(p['value']))
 elif t=='text':b=p['value'].encode();rc=L.sqlite3_bind_text(st,i,b,len(b),TRANSIENT)
 else:b=bytes.fromhex(p['hex']);buf=C.create_string_buffer(b);rc=L.sqlite3_bind_blob(st,i,buf,len(b),TRANSIENT)
 assert rc==0
obs=[]
for case in spec['cases']:
 for enc in case['encodings']:
  db=P();assert L.sqlite3_open(b':memory:',C.byref(db))==0
  e=C.c_char_p();q=f"PRAGMA encoding='{enc}'".encode();assert L.sqlite3_exec(db,q,None,None,C.byref(e))==0
  st=P();tail=C.c_char_p();rc=L.sqlite3_prepare_v2(db,case['sql'].encode(),-1,C.byref(st),C.byref(tail));o={'id':case['id'],'encoding':enc,'sql':case['sql'],'parameters':case.get('parameters',[])}
  if rc:o['error']=err(db,'prepare',rc)
  else:
   for p in case.get('parameters',[]):bind(st,p)
   o['columns']=[L.sqlite3_column_name(st,i).decode() for i in range(L.sqlite3_column_count(st))];o['rows']=[]
   while True:
    rc=L.sqlite3_step(st)
    if rc==100:o['rows'].append([value(st,i) for i in range(L.sqlite3_column_count(st))])
    elif rc==101:break
    else:o['error']=err(db,'step',rc);break
   L.sqlite3_finalize(st)
  L.sqlite3_close(db);obs.append(o)
opts=[];i=0
while True:
 z=L.sqlite3_compileoption_get(i)
 if not z:break
 opts.append(z.decode());i+=1
out={'schemaVersion':1,'kind':'native-reference-only-no-ts-credit','source':{'version':L.sqlite3_libversion().decode(),'sourceId':source,'manifest':'reference/sqlite/manifest.json','manifestSha256':hashlib.sha256((ROOT/'reference/sqlite/manifest.json').read_bytes()).hexdigest(),'specSha256':hashlib.sha256(spec_path.read_bytes()).hexdigest(),'compileOptions':opts},'counts':{'registrations':len(spec['registry']),'cases':len(spec['cases']),'observations':len(obs)},'observations':obs}
path=pathlib.Path(ns.output);path.write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n');print(json.dumps(out['counts'],sort_keys=True))
