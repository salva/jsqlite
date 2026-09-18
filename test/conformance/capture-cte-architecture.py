#!/usr/bin/env python3
"""Capture the pinned SQLite CTE architecture tranche (native evidence only)."""
import argparse, ctypes as C, hashlib, json, pathlib, struct, tempfile
OK, ROW, DONE = 0, 100, 101
P = C.c_void_p
ENCODINGS = {"UTF-8":"UTF-8", "UTF-16le":"UTF-16le", "UTF-16be":"UTF-16be"}

def load(path):
 d=C.CDLL(path); d.sqlite3_libversion.restype=d.sqlite3_sourceid.restype=C.c_char_p
 d.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(P)]; d.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
 d.sqlite3_errmsg.restype=C.c_char_p; d.sqlite3_column_int64.restype=C.c_int64; d.sqlite3_column_double.restype=C.c_double; d.sqlite3_column_blob.restype=P; d.sqlite3_column_text.restype=P
 for n in ("sqlite3_column_name","sqlite3_column_decltype","sqlite3_column_database_name","sqlite3_column_table_name","sqlite3_column_origin_name"):getattr(d,n).restype=P
 return d

def err(d,db,phase): return {"phase":phase,"code":d.sqlite3_errcode(db),"extendedCode":d.sqlite3_extended_errcode(db),"message":d.sqlite3_errmsg(db).decode("utf8","replace")}
def txt(p): return None if not p else C.string_at(p).decode("utf8")
def cell(d,s,i):
 t=d.sqlite3_column_type(s,i)
 if t==5:return {"type":"null"}
 if t==1:return {"type":"integer","value":str(d.sqlite3_column_int64(s,i))}
 if t==2:return {"type":"real","ieee754be":struct.pack(">d",d.sqlite3_column_double(s,i)).hex()}
 n=d.sqlite3_column_bytes(s,i); p=d.sqlite3_column_blob(s,i) if t==4 else d.sqlite3_column_text(s,i); b=C.string_at(p,n) if p else b""
 return {"type":"blob","hex":b.hex()} if t==4 else {"type":"text","utf8Hex":b.hex()}
def statement(d,db,sql,capture):
 s=P(); raw=sql.encode(); tail=C.c_char_p(); rc=d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(s),C.byref(tail))
 if rc!=OK:return {"prepare":{"kind":"error",**err(d,db,"prepare")}}
 try:
  if not capture:
   while True:
    rc=d.sqlite3_step(s)
    if rc==ROW:continue
    if rc!=DONE:raise RuntimeError(err(d,db,"step"))
    return {"prepare":{"kind":"ok"}}
  n=d.sqlite3_column_count(s); fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]; keys=["name","declaredType","database","table","origin"]
  out={"prepare":{"kind":"ok"},"columns":[dict(zip(keys,[txt(fn(s,i)) for fn in fns])) for i in range(n)],"rows":[]}
  while True:
   rc=d.sqlite3_step(s)
   if rc==ROW:out["rows"].append([cell(d,s,i) for i in range(n)]);continue
   if rc!=DONE:out["step"]={"kind":"error",**err(d,db,"step")}
   else:out["step"]={"kind":"done"}
   return out
 finally:d.sqlite3_finalize(s)
def main():
 a=argparse.ArgumentParser();a.add_argument("--library",required=True);a.add_argument("--spec",required=True);a.add_argument("--output",required=True);x=a.parse_args(); spec=json.load(open(x.spec));d=load(x.library)
 assert [d.sqlite3_libversion().decode(),d.sqlite3_sourceid().decode()]==[spec["source"]["version"],spec["source"]["sourceId"]]
 root=pathlib.Path(__file__).parents[2]
 for p,h in spec["upstreamFiles"].items():assert hashlib.sha256((root/"reference/sqlite/sqlite-src-3530400"/p.removeprefix("test/") if False else root/p).read_bytes()).hexdigest()==h
 out=[]
 for case in spec["cases"]:
  for label,pragma in ENCODINGS.items():
   with tempfile.TemporaryDirectory() as td:
    db=P(); assert d.sqlite3_open(str(pathlib.Path(td)/"case.db").encode(),C.byref(db))==OK
    try:
     statement(d,db,f"PRAGMA encoding='{pragma}'",False)
     for setup in case["setup"]:
      got=statement(d,db,setup,False)
      if got["prepare"]["kind"]!="ok":raise RuntimeError((case["id"],setup,got))
     native=statement(d,db,case["sql"],True)
     out.append({"id":case["id"],"credit":case["credit"],"databaseEncoding":label,"sql":case["sql"],"native":native})
    finally:d.sqlite3_close(db)
 result={"schema":"jsqlite-cte-architecture-capture/1","source":spec["source"],"disposition":spec["disposition"],"accounting":{"cases":len(spec["cases"]),"upstreamCreditCases":sum(c["credit"]=="upstream" for c in spec["cases"]),"companionsNoCredit":sum(c["credit"]=="none" for c in spec["cases"]),"encodingExecutions":len(out),"typescriptAttempted":0,"typescriptCredited":0},"captures":out}
 pathlib.Path(x.output).write_text(json.dumps(result,indent=2)+"\n")
if __name__=="__main__":main()
