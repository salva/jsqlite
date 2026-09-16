#!/usr/bin/env python3
"""Capture the source-pinned multi-source SELECT contract; development only."""
from __future__ import annotations
import argparse, ctypes as C, json, pathlib, struct
OK, ROW, DONE = 0, 100, 101
P=C.c_void_p

def load(path):
    d=C.CDLL(path)
    for n in ("sqlite3_column_database_name","sqlite3_column_table_name","sqlite3_column_origin_name"):
        if not hasattr(d,n): raise SystemExit(f"oracle lacks column metadata: {n}")
    d.sqlite3_sourceid.restype=C.c_char_p; d.sqlite3_libversion.restype=C.c_char_p
    d.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(P)]; d.sqlite3_close.argtypes=[P]
    d.sqlite3_exec.argtypes=[P,C.c_char_p,P,P,C.POINTER(C.c_char_p)]
    d.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
    d.sqlite3_step.argtypes=[P]; d.sqlite3_reset.argtypes=[P]; d.sqlite3_finalize.argtypes=[P]
    d.sqlite3_clear_bindings.argtypes=[P]; d.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_int64]
    d.sqlite3_column_count.argtypes=[P]; d.sqlite3_column_type.argtypes=[P,C.c_int]
    d.sqlite3_column_int64.argtypes=[P,C.c_int]; d.sqlite3_column_int64.restype=C.c_int64
    d.sqlite3_column_double.argtypes=[P,C.c_int]; d.sqlite3_column_double.restype=C.c_double
    d.sqlite3_column_bytes.argtypes=[P,C.c_int]
    for n in ("sqlite3_column_blob","sqlite3_column_text","sqlite3_column_name","sqlite3_column_decltype","sqlite3_column_database_name","sqlite3_column_table_name","sqlite3_column_origin_name"):
        getattr(d,n).restype=P
    d.sqlite3_errcode.argtypes=[P]; d.sqlite3_extended_errcode.argtypes=[P]
    d.sqlite3_errmsg.argtypes=[P]; d.sqlite3_errmsg.restype=C.c_char_p
    return d

def txt(fn,st,i):
    p=fn(st,i); return None if not p else C.string_at(p).decode("utf-8","strict")
def cell(d,st,i):
    t=d.sqlite3_column_type(st,i)
    if t==5:return {"type":"null"}
    if t==1:return {"type":"integer","value":str(d.sqlite3_column_int64(st,i))}
    if t==2:return {"type":"real","ieee754be":struct.pack(">d",d.sqlite3_column_double(st,i)).hex()}
    n=d.sqlite3_column_bytes(st,i); p=d.sqlite3_column_blob(st,i) if t==4 else d.sqlite3_column_text(st,i)
    raw=C.string_at(p,n) if p else b""
    return {"type":"blob","hex":raw.hex()} if t==4 else {"type":"text","utf8Hex":raw.hex()}
def err(d,db,op):
    return {"operation":op,"resultCode":d.sqlite3_errcode(db),"extendedCode":d.sqlite3_extended_errcode(db),"message":d.sqlite3_errmsg(db).decode("utf-8","replace")}
def bind(d,st,vals):
    for i,v in enumerate(vals,1):
        if v["type"]!="integer": raise RuntimeError("capture currently admits integer bindings only")
        rc=d.sqlite3_bind_int64(st,i,int(v["value"]));
        if rc!=OK: raise RuntimeError(f"bind failed: {rc}")
def rows(d,st,n):
    out=[]
    while True:
        rc=d.sqlite3_step(st)
        if rc==ROW: out.append([cell(d,st,i) for i in range(n)]); continue
        return rc,out

def capture(d,spec,c):
    db=P(); st=P(); rc=d.sqlite3_open(b":memory:",C.byref(db))
    if rc!=OK: raise RuntimeError("open failed")
    try:
        for sql in spec["setups"][c["setup"]]:
            ep=C.c_char_p(); rc=d.sqlite3_exec(db,sql.encode(),None,None,C.byref(ep))
            if rc!=OK: raise RuntimeError(f"setup {c['setup']}: {ep.value!r}")
        raw=c["sql"].encode(); tail=C.c_char_p(); rc=d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(st),C.byref(tail))
        if rc!=OK:
            return {"prepare":{"kind":"error",**err(d,db,"prepare")}}
        n=d.sqlite3_column_count(st)
        fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
        keys=["name","declType","database","table","origin"]
        columns=[dict(zip(keys,[txt(f,st,i) for f in fns])) for i in range(n)]
        bind(d,st,c.get("bindings",[])); rc,first=rows(d,st,n)
        if rc!=DONE:return {"prepare":{"kind":"ok"},"columns":columns,"first":{"kind":"error","partialRows":first,"error":err(d,db,"step")}}
        out={"prepare":{"kind":"ok"},"columns":columns,"first":{"kind":"done","rows":first}}
        if "rebind" in c:
            rr=d.sqlite3_reset(st)
            if rr!=OK: raise RuntimeError(f"reset: {rr}")
            rr=d.sqlite3_clear_bindings(st)
            if rr!=OK: raise RuntimeError(f"clear: {rr}")
            bind(d,st,c["rebind"]); rc,second=rows(d,st,n)
            out["afterResetRebind"]={"kind":"done","rows":second} if rc==DONE else {"kind":"error","partialRows":second,"error":err(d,db,"step")}
        return out
    finally:
        if st: d.sqlite3_finalize(st)
        d.sqlite3_close(db)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--library",required=True); ap.add_argument("--spec",required=True); ap.add_argument("--output",required=True); a=ap.parse_args()
    spec=json.load(open(a.spec)); d=load(a.library)
    sid=d.sqlite3_sourceid().decode(); ver=d.sqlite3_libversion().decode()
    if (sid,ver)!=(spec["source"]["sourceId"],spec["source"]["version"]): raise SystemExit("native identity mismatch")
    cases=[]
    for c in spec["cases"]:
        x={k:v for k,v in c.items() if k not in ("bindings","rebind")}; x["native"]=capture(d,spec,c); cases.append(x)
    out={"schema":"jsqlite-multisource-select/1","source":spec["source"],"requiredCoverage":spec["requiredCoverage"],"cases":cases,"accounting":{"declared":len(cases),"nativeCaptured":len(cases),"tsAttempted":0,"tsCredited":0}}
    pathlib.Path(a.output).write_text(json.dumps(out,indent=2,ensure_ascii=False)+"\n")
if __name__=="__main__": main()
