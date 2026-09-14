#!/usr/bin/env python3
"""Development-only JSONL operation oracle for the executable bounded tranche."""
import argparse,base64,ctypes as C,json,pathlib,struct,sys
P=C.c_void_p; SCHEMA="jsqlite-oracle/1"; OK=0
def b(v): return {"encoding":"base64","bytes":len(v),"data":base64.b64encode(v).decode()}
def status(rc): return {"resultCode":rc,"primaryCode":rc&255,"directDiagnostic":None,"errorAfter":None}
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("--library",required=True); ap.add_argument("--case-root",required=True); ap.add_argument("--profile",required=True); a=ap.parse_args(); root=pathlib.Path(a.case_root).resolve(); profile=json.load(open(a.profile)); L=C.CDLL(a.library)
 L.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]; L.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]; L.sqlite3_step.argtypes=[P]; L.sqlite3_column_count.argtypes=[P]; L.sqlite3_column_type.argtypes=[P,C.c_int]; L.sqlite3_column_int64.argtypes=[P,C.c_int]; L.sqlite3_column_int64.restype=C.c_longlong; L.sqlite3_column_double.argtypes=[P,C.c_int]; L.sqlite3_column_double.restype=C.c_double; L.sqlite3_column_text.argtypes=[P,C.c_int]; L.sqlite3_column_text.restype=P; L.sqlite3_column_blob.argtypes=[P,C.c_int]; L.sqlite3_column_blob.restype=P; L.sqlite3_column_bytes.argtypes=[P,C.c_int]; L.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_longlong]; L.sqlite3_clear_bindings.argtypes=[P]
 dbs={}; stmts={}; owners={}; nxt=1; last=-1
 def alloc(m,v):
  nonlocal nxt; h=nxt;nxt+=1;m[h]=v;return h
 def value(s,i):
  t=L.sqlite3_column_type(s,i)
  if t==5:return {"kind":"null"}
  if t==1:return {"kind":"integer","decimal":str(L.sqlite3_column_int64(s,i))}
  if t==2:return {"kind":"real","ieee754be":struct.pack(">d",L.sqlite3_column_double(s,i)).hex()}
  n=L.sqlite3_column_bytes(s,i); p=L.sqlite3_column_blob(s,i) if t==4 else L.sqlite3_column_text(s,i); raw=C.string_at(p,n) if n else b""
  return {"kind":"blob","value":b(raw)} if t==4 else {"kind":"text","utf8":b(raw),"databaseEncoding":None}
 for line in sys.stdin:
  try:
   q=json.loads(line); seq=q["seq"]
   if q.get("schema")!=SCHEMA or not isinstance(seq,int) or seq<=last: raise ValueError("schema/seq")
   last=seq; op=q["op"]
   if op=="hello": r={"op":"hello",**profile}
   elif op=="open":
    rel=pathlib.PurePosixPath(q["path"])
    if rel.is_absolute() or ".." in rel.parts: raise ValueError("path")
    path=(root/pathlib.Path(*rel.parts)).resolve()
    if root not in path.parents and path!=root: raise ValueError("path")
    d=P(); rc=L.sqlite3_open_v2(str(path).encode(),C.byref(d),1 if q["flags"]=="readonly" else 6,None); h=alloc(dbs,d) if d.value else None; r={"op":"open","status":status(rc),"db":h,"databaseEncoding":None}
   elif op=="prepare":
    raw=base64.b64decode(q["sql"]["data"],validate=True); buf=C.create_string_buffer(raw+b"\0"); s=P(); tail=C.c_char_p(); rc=L.sqlite3_prepare_v2(dbs[q["db"]],buf,q["byteLimit"],C.byref(s),C.byref(tail)); h=alloc(stmts,s) if s.value else None
    if h: owners[h]=q["db"]
    off=(C.cast(tail,P).value-C.addressof(buf)) if tail.value is not None else 0; r={"op":"prepare","status":status(rc),"stmt":h,"tailOffsetBytes":off,"tail":b(raw[off:]) if rc==0 else None}
   elif op=="bind":
    v=q["value"]; rc=L.sqlite3_bind_int64(stmts[q["stmt"]],q["index"],int(v["decimal"])) if v["kind"]=="integer" else L.sqlite3_bind_null(stmts[q["stmt"]],q["index"]); r={"op":"bind","status":status(rc)}
   elif op=="clearBindings": r={"op":op,"status":status(L.sqlite3_clear_bindings(stmts[q["stmt"]]))}
   elif op=="reset": r={"op":op,"status":status(L.sqlite3_reset(stmts[q["stmt"]]))}
   elif op=="step":
    s=stmts[q["stmt"]]; rc=L.sqlite3_step(s); row=[{"ordinal":i,"initialType":["","integer","real","text","blob","null"][L.sqlite3_column_type(s,i)],"value":value(s,i)} for i in range(L.sqlite3_column_count(s))] if rc==100 else None; r={"op":"step","status":status(rc),"step":"row" if rc==100 else "done" if rc==101 else "error","row":row}
   elif op=="finalize": h=q["stmt"]; rc=L.sqlite3_finalize(stmts.pop(h)); owners.pop(h,None); r={"op":op,"status":status(rc),"destroyed":True}
   elif op=="close": h=q["db"]; rc=(L.sqlite3_close_v2 if q["mode"]=="v2" else L.sqlite3_close)(dbs[h]); destroyed=rc==0 and h not in owners.values();
   else: raise ValueError("unknown op")
   if op=="close":
    if rc==0: dbs.pop(h,None)
    r={"op":"close","status":status(rc),"destroyed":destroyed,"zombie":rc==0 and not destroyed}
   print(json.dumps({"schema":SCHEMA,"seq":seq,"outcome":"ok","result":r},separators=(",",":")),flush=True)
  except Exception as e:
   print(json.dumps({"schema":SCHEMA,"seq":q.get("seq") if isinstance(q,dict) else None,"outcome":"protocol-error","error":{"message":str(e)}}),flush=True); return 2
 return 0
if __name__=="__main__": raise SystemExit(main())
