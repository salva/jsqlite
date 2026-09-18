#!/usr/bin/env python3
"""Capture immutable, development-only SQLite window evidence."""
from __future__ import annotations
import argparse, ctypes as C, json, pathlib, struct
OK, ROW, DONE = 0, 100, 101

def load(path):
 d=C.CDLL(path); d.sqlite3_sourceid.restype=C.c_char_p; d.sqlite3_libversion.restype=C.c_char_p
 d.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]; d.sqlite3_close.argtypes=[C.c_void_p]
 d.sqlite3_exec.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_char_p)]
 d.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.POINTER(C.c_char_p)]
 for n in ('sqlite3_step','sqlite3_reset','sqlite3_finalize','sqlite3_column_count'): getattr(d,n).argtypes=[C.c_void_p]
 d.sqlite3_bind_int64.argtypes=[C.c_void_p,C.c_int,C.c_int64]
 d.sqlite3_column_type.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_int64.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_int64.restype=C.c_int64
 d.sqlite3_column_double.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_double.restype=C.c_double
 d.sqlite3_column_bytes.argtypes=[C.c_void_p,C.c_int]
 for n in ('sqlite3_column_text','sqlite3_column_blob','sqlite3_column_name','sqlite3_column_decltype','sqlite3_errmsg'):
  getattr(d,n).restype=C.c_void_p
 d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,C.c_void_p,C.c_void_p]
 return d

def textptr(p): return None if not p else C.string_at(p).decode('utf8','replace')
def cell(d,s,i):
 t=d.sqlite3_column_type(s,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(d.sqlite3_column_int64(s,i))}
 if t==2:return {'type':'real','ieee754be':struct.pack('>d',d.sqlite3_column_double(s,i)).hex()}
 n=d.sqlite3_column_bytes(s,i); p=d.sqlite3_column_blob(s,i) if t==4 else d.sqlite3_column_text(s,i); raw=C.string_at(p,n) if p else b''
 return {'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex()}
def execsql(d,h,sql):
 e=C.c_char_p(); rc=d.sqlite3_exec(h,sql.encode(),None,None,C.byref(e))
 if rc: raise RuntimeError(f'{sql}: {e.value!r}')
def run(d,spec,c):
 h=C.c_void_p(); assert d.sqlite3_open(b':memory:',C.byref(h))==OK
 if c.get('encoding'): execsql(d,h,"PRAGMA encoding='%s'"%c['encoding'])
 for q in spec['setups'][c['setup']]: execsql(d,h,q)
 st=C.c_void_p(); raw=c['sql'].encode(); rc=d.sqlite3_prepare_v2(h,raw,len(raw),C.byref(st),None)
 observed={'prepareCode':rc,'columns':[],'runs':[]}
 if c.get('errorPhase')=='prepare':
  observed['errorMessage']=textptr(d.sqlite3_errmsg(h)); assert rc!=OK
 else:
  if rc!=OK: raise RuntimeError(f"{c['id']} prepare: {textptr(d.sqlite3_errmsg(h))}")
  n=d.sqlite3_column_count(st)
  observed['columns']=[{'name':textptr(d.sqlite3_column_name(st,i)),'declType':textptr(d.sqlite3_column_decltype(st,i))} for i in range(n)]
  bindings=c.get('bindings',[])
  for b in bindings: assert d.sqlite3_bind_int64(st,b['index'],int(b['integer']))==OK
  cb=None
  if c.get('progressAbortAfter'):
   calls=[0]
   @C.CFUNCTYPE(C.c_int)
   def cb(): calls[0]+=1; return calls[0]>=c['progressAbortAfter']
   d.sqlite3_progress_handler(h,1,cb,None)
  for pass_bind in [None]+([c['rebind']] if c.get('rebind') else []):
   if pass_bind:
    assert d.sqlite3_reset(st)==OK
    for b in pass_bind: assert d.sqlite3_bind_int64(st,b['index'],int(b['integer']))==OK
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==ROW: rows.append([cell(d,st,i) for i in range(n)]); continue
    break
   observed['runs'].append({'rows':rows,'terminalCode':rc,'errorMessage':None if rc==DONE else textptr(d.sqlite3_errmsg(h))})
  if c.get('progressAbortAfter'): d.sqlite3_progress_handler(h,0,None,None)
  if c.get('errorPhase')=='step': assert observed['runs'][0]['terminalCode']!=DONE
  else: assert all(x['terminalCode']==DONE for x in observed['runs'])
 if st: observed['finalizeCode']=d.sqlite3_finalize(st)
 observed['closeCode']=d.sqlite3_close(h)
 return observed

def main():
 p=argparse.ArgumentParser(); p.add_argument('--library',required=True); p.add_argument('--spec',required=True); p.add_argument('--output',required=True); a=p.parse_args()
 spec=json.load(open(a.spec)); d=load(a.library)
 if [d.sqlite3_libversion().decode(),d.sqlite3_sourceid().decode()] != [spec['source']['version'],spec['source']['sourceId']]: raise SystemExit('native identity mismatch')
 out={'schema':'jsqlite-window-evidence/1','source':spec['source'],'requiredCoverage':spec['requiredCoverage'],'cases':[]}
 for c in spec['cases']:
  x={k:v for k,v in c.items() if k not in ('bindings','rebind','progressAbortAfter')}
  x['native']={'disposition':'source-only-no-credit'} if c.get('kind')=='source-only' else run(d,spec,c)
  x['ts']={'attempted':False,'credited':False,'disposition':'unimplemented-temporary'}
  out['cases'].append(x)
 up=sum(c['credit']=='upstream' for c in spec['cases']); comp=len(spec['cases'])-up; native=len(spec['cases'])-sum(c.get('kind')=='source-only' for c in spec['cases'])
 out['accounting']={'declared':len(spec['cases']),'upstreamDeclared':up,'companionsDeclared':comp,'nativeAttempted':native,'nativePassed':native,'nativeCredited':up,'sourceOnlyCompanions':len(spec['cases'])-native,'tsAttempted':0,'tsCredited':0,'tsUnattempted':len(spec['cases']),'exhaustiveClaim':False}
 pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__': main()
