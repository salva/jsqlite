#!/usr/bin/env python3
"""Capture the manifest-pinned aggregate/GROUP contract from immutable Fetch fixtures."""
import argparse,ctypes as C,json,pathlib,struct,hashlib
OK,ROW,DONE,OPEN_READONLY=0,100,101,1
P=C.c_void_p

def load(path):
 d=C.CDLL(path); d.sqlite3_sourceid.restype=d.sqlite3_libversion.restype=C.c_char_p
 d.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]; d.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
 for n in ('sqlite3_step','sqlite3_reset','sqlite3_finalize','sqlite3_clear_bindings'): getattr(d,n).argtypes=[P]
 d.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_int64]; d.sqlite3_column_int64.restype=C.c_int64; d.sqlite3_column_double.restype=C.c_double; d.sqlite3_column_blob.restype=P; d.sqlite3_column_text.restype=P
 for n in ('sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name'): getattr(d,n).restype=P
 d.sqlite3_errmsg.restype=C.c_char_p
 return d

def text(p): return None if not p else C.string_at(p).decode('utf8','strict')
def error(d,db,phase): return {'phase':phase,'code':d.sqlite3_errcode(db),'extendedCode':d.sqlite3_extended_errcode(db),'message':d.sqlite3_errmsg(db).decode('utf8','replace')}
def cell(d,s,i):
 t=d.sqlite3_column_type(s,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(d.sqlite3_column_int64(s,i))}
 if t==2:return {'type':'real','ieee754be':struct.pack('>d',d.sqlite3_column_double(s,i)).hex()}
 n=d.sqlite3_column_bytes(s,i);p=d.sqlite3_column_blob(s,i) if t==4 else d.sqlite3_column_text(s,i);raw=C.string_at(p,n) if p else b''
 return {'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex()}
def bind(d,s,vs):
 for i,v in enumerate(vs,1):
  if v['type']!='integer':raise ValueError('only tagged integer bindings admitted')
  if d.sqlite3_bind_int64(s,i,int(v['value']))!=OK:raise RuntimeError('bind failed')
def run(d,db,s,n):
 rows=[]
 while True:
  rc=d.sqlite3_step(s)
  if rc==ROW:rows.append([cell(d,s,i) for i in range(n)]);continue
  return {'kind':'done','rows':rows} if rc==DONE else {'kind':'error','partialRows':rows,'error':error(d,db,'step')}
def main():
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--spec',required=True);a.add_argument('--output',required=True);a.add_argument('--fixture-root',required=True);x=a.parse_args(); spec=json.load(open(x.spec));d=load(x.library)
 assert (d.sqlite3_libversion().decode(),d.sqlite3_sourceid().decode())==(spec['source']['version'],spec['source']['sourceId'])
 root=pathlib.Path(x.fixture_root)/'generations'/spec['fixtureGeneration']; cat=json.load(open(root/'catalog.json')); fixtures={f['id']:f for f in cat['semantic']['fixtures']};out=[]
 for c in spec['cases']:
  f=fixtures[c['fixture']];path=root/f['path'];assert hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256'];db=P();s=P();rc=d.sqlite3_open_v2(str(path).encode(),C.byref(db),OPEN_READONLY,None);assert rc==OK
  try:
   raw=c['sql'].encode();tail=C.c_char_p();rc=d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(s),C.byref(tail));o={'id':c['id'],'fixture':c['fixture'],'fixtureSha256':f['sha256'],'databaseEncoding':f['encoding'],'sql':c['sql']}
   if rc!=OK:o['native']={'prepare':{'kind':'error',**error(d,db,'prepare')}}
   else:
    n=d.sqlite3_column_count(s);fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name];keys=['name','declaredType','database','table','origin']
    o['native']={'prepare':{'kind':'ok'},'columns':[dict(zip(keys,[text(fn(s,i)) for fn in fns])) for i in range(n)]};bind(d,s,c.get('bindings',[]));o['native']['first']=run(d,db,s,n)
    if 'rebind' in c:
     o['native']['resetCode']=d.sqlite3_reset(s);d.sqlite3_clear_bindings(s);bind(d,s,c['rebind']);o['native']['afterResetRebind']=run(d,db,s,n)
   out.append(o)
  finally:
   if s:o.setdefault('native',{})['finalizeCode']=d.sqlite3_finalize(s)
   d.sqlite3_close(db)
 result={'schema':'jsqlite-aggregate-group-contract/1','source':spec['source'],'fixtureGeneration':spec['fixtureGeneration'],'requiredCoverage':spec['requiredCoverage'],'cases':out,'accounting':{'declared':len(out),'nativeCaptured':len(out),'tsAttempted':0,'tsCredited':0}}
 pathlib.Path(x.output).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
main()
