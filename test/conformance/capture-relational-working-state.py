#!/usr/bin/env python3
"""Capture the bounded relational working-state tranche with pinned native SQLite.

Development-only: this module must never be imported by runtime TypeScript.
"""
from __future__ import annotations
import argparse, ctypes as C, json, pathlib, struct

OK, ROW, DONE, INTERRUPT = 0, 100, 101, 9

def cell(db, st, i):
    t=db.sqlite3_column_type(st,i)
    if t==5: return {"type":"null"}
    if t==1: return {"type":"integer","value":str(db.sqlite3_column_int64(st,i))}
    if t==2: return {"type":"real","ieee754be":struct.pack('>d',db.sqlite3_column_double(st,i)).hex()}
    n=db.sqlite3_column_bytes(st,i); p=db.sqlite3_column_blob(st,i) if t==4 else db.sqlite3_column_text(st,i)
    raw=C.string_at(p,n) if p else b''
    return {"type":"blob","hex":raw.hex()} if t==4 else {"type":"text","utf8Hex":raw.hex()}

def text_at(fn, st, i):
    p=fn(st,i); return None if not p else C.string_at(p).decode('utf-8','strict')

def load(path):
    d=C.CDLL(path)
    # Requiring these symbols distinguishes unavailable provenance from SQL NULL.
    required=['sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']
    for name in required:
        if not hasattr(d,name): raise SystemExit(f'native oracle lacks SQLITE_ENABLE_COLUMN_METADATA symbol: {name}')
    d.sqlite3_sourceid.restype=C.c_char_p; d.sqlite3_libversion.restype=C.c_char_p
    d.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]; d.sqlite3_close.argtypes=[C.c_void_p]
    d.sqlite3_exec.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_char_p)]
    d.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.POINTER(C.c_char_p)]
    d.sqlite3_stmt_readonly.argtypes=[C.c_void_p]
    d.sqlite3_step.argtypes=[C.c_void_p]; d.sqlite3_reset.argtypes=[C.c_void_p]; d.sqlite3_finalize.argtypes=[C.c_void_p]
    d.sqlite3_column_count.argtypes=[C.c_void_p]; d.sqlite3_column_type.argtypes=[C.c_void_p,C.c_int]
    d.sqlite3_column_int64.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_int64.restype=C.c_int64
    d.sqlite3_column_double.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_double.restype=C.c_double
    d.sqlite3_column_bytes.argtypes=[C.c_void_p,C.c_int]
    for n in ['sqlite3_column_blob','sqlite3_column_text','sqlite3_column_name','sqlite3_column_decltype','sqlite3_column_database_name','sqlite3_column_table_name','sqlite3_column_origin_name']:
        getattr(d,n).restype=C.c_void_p
    d.sqlite3_errcode.argtypes=[C.c_void_p]; d.sqlite3_extended_errcode.argtypes=[C.c_void_p]
    d.sqlite3_errmsg.argtypes=[C.c_void_p]; d.sqlite3_errmsg.restype=C.c_char_p
    d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,C.c_void_p,C.c_void_p]
    return d

def capture_case(d,spec,c):
    ops=c.get('capture',{}).get('operations',['openFixture','prepare','metadata','stepAll','finalize','close'])
    trace=[]; attempted=set(); first=None; rows=[]; columns=None; handle=C.c_void_p(); stmt=C.c_void_p(); cb=None
    def add(op,outcome,rc=None,**more):
        i=ops.index(op); attempted.add(i); x={'index':i,'op':op,'outcome':outcome}
        if rc is not None:x['resultCode']=rc
        x.update(more); trace.append(x)
    def failure(op,rc):
        nonlocal first
        e={'id':'native-first-error','operation':op,'resultCode':rc,'primaryCode':d.sqlite3_errcode(handle),'extendedCode':d.sqlite3_extended_errcode(handle),'message':d.sqlite3_errmsg(handle).decode('utf-8','replace')}
        if first is None: first=e
        return e
    before={'openCursors':0,'sorters':0,'ephemeralSets':0,'borrowGenerations':0}
    rc=d.sqlite3_open(b':memory:',C.byref(handle)); add('openFixture','passed' if rc==OK else 'failed',rc)
    if rc!=OK: first=failure('openFixture',rc)
    if not first:
        for sql in spec['setups'][c['setup']]:
            err=C.c_char_p(); rc=d.sqlite3_exec(handle,sql.encode(),None,None,C.byref(err))
            if rc!=OK: raise RuntimeError(f"setup {c['setup']}: {err.value!r}")
        tail=C.c_char_p(); raw=c['sql'].encode(); rc=d.sqlite3_prepare_v2(handle,raw,len(raw),C.byref(stmt),C.byref(tail))
        add('prepare','passed' if rc==OK else 'failed',rc)
        if rc!=OK:first=failure('prepare',rc)
        elif not d.sqlite3_stmt_readonly(stmt): raise RuntimeError(f"public assertion is not read-only: {c['id']}")
    if not first:
        n=d.sqlite3_column_count(stmt); columns=[]
        fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
        keys=['name','declType','database','table','origin']
        for i in range(n): columns.append(dict(zip(keys,[text_at(f,stmt,i) for f in fns])))
        add('metadata','passed')
        abort=c.get('capture',{}).get('progressAbortAfter')
        if abort:
            count=[0]
            @C.CFUNCTYPE(C.c_int)
            def cb(): count[0]+=1; return int(count[0]>=abort)
            d.sqlite3_progress_handler(handle,1,cb,None)
        while True:
            rc=d.sqlite3_step(stmt)
            if rc==ROW: rows.append([cell(d,stmt,i) for i in range(n)]); continue
            if rc==DONE: add('stepAll','passed',rc); break
            add('stepAll','failed',rc); first=failure('stepAll',rc); break
        if abort:d.sqlite3_progress_handler(handle,0,None,None)
    if 'reset' in ops and stmt:
        rc=d.sqlite3_reset(stmt); add('reset','passed' if rc==OK else 'failed',rc,errorRef=first['id'] if rc!=OK and first else None)
        trace[-1]={k:v for k,v in trace[-1].items() if v is not None}
        if rc!=OK and first is None:first=failure('reset',rc)
    if stmt:
        rc=d.sqlite3_finalize(stmt); add('finalize','passed' if rc==OK else 'failed',rc,errorRef=first['id'] if rc!=OK and first else None)
        trace[-1]={k:v for k,v in trace[-1].items() if v is not None}
        if rc!=OK and first is None:first=failure('finalize',rc)
    if handle:
        rc=d.sqlite3_close(handle); add('close','passed' if rc==OK else 'failed',rc)
        if rc!=OK and first is None:first=failure('close',rc)
    trace.sort(key=lambda x:x['index'])
    native={'operationTrace':trace,'unattempted':[{'index':i,'op':op} for i,op in enumerate(ops) if i not in attempted]}
    if columns is not None:native['columns']=columns
    native['terminal']={'kind':'done','rows':rows} if first is None else ({'kind':'error','firstError':first} if first['operation'] in ('openFixture','prepare') else {'kind':'error','partialRows':rows,'firstError':first})
    if c.get('capture',{}).get('resourceSnapshots'): native['resources']={'before':before,'afterCleanup':before.copy(),'accountingScope':'capture-owned handles; engine-private counts inferred as zero only after successful close'}
    return native,ops

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--library',required=True); ap.add_argument('--spec',required=True); ap.add_argument('--output',required=True); a=ap.parse_args()
    spec=json.load(open(a.spec)); d=load(a.library)
    sid=d.sqlite3_sourceid().decode(); ver=d.sqlite3_libversion().decode()
    if (sid,ver)!=(spec['source']['sourceId'],spec['source']['version']): raise SystemExit('native identity mismatch before fixture setup')
    out={k:spec[k] for k in ('source','requiredCoverage')}; out['schema']='jsqlite-relational-working-state/4'; out['cases']=[]
    for c in spec['cases']:
        native,ops=capture_case(d,spec,c); x={k:v for k,v in c.items() if k!='capture'}; x['operations']=ops; x['native']=native
        x['ts']={'disposition':'not-applicable-no-credit' if c['credit']=='no-credit-companion' else 'unimplemented-temporary','attempted':[],'unattempted':[{'index':i,'op':op} for i,op in enumerate(ops)],'credit':False}
        out['cases'].append(x)
    up=sum(x['credit']=='upstream' for x in out['cases']); co=len(out['cases'])-up
    out['accounting']={'upstreamDeclared':up,'companionsDeclared':co,'nativeMatched':len(out['cases']),'tsCreditedCases':0,'nativeExpectationsSeparateFromTsCredit':True,'countDerivedSuccessForbidden':True}
    pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__':main()
