#!/usr/bin/env python3
"""Executable bounded first tranche against pinned native SQLite.
Outputs one JSON record per upstream assertion or explicitly no-credit companion
observation and exits nonzero on divergence.
"""
import ctypes as C, json, math, os, pathlib, struct, sys
lib=C.CDLL(sys.argv[1]); P=C.c_void_p
lib.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
lib.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
lib.sqlite3_prepare16_v2.argtypes=[P,P,C.c_int,C.POINTER(P),C.POINTER(P)]
lib.sqlite3_step.argtypes=[P]; lib.sqlite3_column_text.argtypes=[P,C.c_int]; lib.sqlite3_column_text.restype=C.c_char_p
lib.sqlite3_column_int64.argtypes=[P,C.c_int]; lib.sqlite3_column_int64.restype=C.c_longlong
lib.sqlite3_column_type.argtypes=[P,C.c_int]; lib.sqlite3_column_double.argtypes=[P,C.c_int]; lib.sqlite3_column_double.restype=C.c_double
lib.sqlite3_column_blob.argtypes=[P,C.c_int]; lib.sqlite3_column_blob.restype=P; lib.sqlite3_column_bytes.argtypes=[P,C.c_int]
lib.sqlite3_column_name.argtypes=[P,C.c_int]; lib.sqlite3_column_name.restype=C.c_char_p
lib.sqlite3_column_decltype.argtypes=[P,C.c_int]; lib.sqlite3_column_decltype.restype=C.c_char_p
lib.sqlite3_column_database_name.argtypes=[P,C.c_int]; lib.sqlite3_column_database_name.restype=C.c_char_p
lib.sqlite3_column_table_name.argtypes=[P,C.c_int]; lib.sqlite3_column_table_name.restype=C.c_char_p
lib.sqlite3_column_origin_name.argtypes=[P,C.c_int]; lib.sqlite3_column_origin_name.restype=C.c_char_p
lib.sqlite3_bind_parameter_count.argtypes=[P]; lib.sqlite3_bind_parameter_name.argtypes=[P,C.c_int]; lib.sqlite3_bind_parameter_name.restype=C.c_char_p
lib.sqlite3_bind_parameter_index.argtypes=[P,C.c_char_p]
lib.sqlite3_bind_int64.argtypes=[P,C.c_int,C.c_longlong]
lib.sqlite3_bind_double.argtypes=[P,C.c_int,C.c_double]
lib.sqlite3_bind_null.argtypes=[P,C.c_int]
lib.sqlite3_bind_text.argtypes=[P,C.c_int,C.c_char_p,C.c_int,P]
lib.sqlite3_bind_blob.argtypes=[P,C.c_int,P,C.c_int,P]
lib.sqlite3_clear_bindings.argtypes=[P]
lib.sqlite3_reset.argtypes=[P]
OK,ROW,DONE,BUSY,MISUSE=0,100,101,5,21; seen=[]
def check(ref,got,want):
 if got!=want: raise AssertionError(f"{ref}: {got!r} != {want!r}")
 seen.append({"ref":ref,"lane":"oracle","outcome":"pass"})
def opendb(path):
 d=P(); check("fixture-open:"+path.name,lib.sqlite3_open_v2(os.fsencode(path),C.byref(d),1,None),OK); return d
def prep(d,sql):
 s=P(); tail=C.c_char_p(); buf=C.create_string_buffer(sql.encode()); rc=lib.sqlite3_prepare_v2(d,buf,-1,C.byref(s),C.byref(tail)); return rc,s,(tail.value or b"").decode()
def fhex(v): return struct.pack(">d",v).hex()
def blob(s,i):
 n=lib.sqlite3_column_bytes(s,i); p=lib.sqlite3_column_blob(s,i); return C.string_at(p,n) if n else b""
root=pathlib.Path(sys.argv[2]); cur=json.loads((root/"CURRENT.json").read_text()); gen=root/"generations"/cur["generationId"]/"generated"
# close.test 1.1-1.4.4
D=opendb(gen/"close.db"); check("close.test:close-1.1",lib.sqlite3_close_v2(D),OK)
D=opendb(gen/"close.db"); rc,S,_=prep(D,"SELECT * FROM t1"); check("close.test:close-1.2.1",(rc,lib.sqlite3_close_v2(D)),(OK,OK)); check("close.test:close-1.2.2",lib.sqlite3_finalize(S),OK)
D=opendb(gen/"close.db"); _,S,_=prep(D,"SELECT * FROM t1"); check("close.test:close-1.3.1",(lib.sqlite3_step(S),lib.sqlite3_close_v2(D)),(ROW,OK)); check("close.test:close-1.3.2",lib.sqlite3_column_text(S,0),b"one"); check("close.test:close-1.3.3",lib.sqlite3_finalize(S),OK)
D=opendb(gen/"close.db"); _,S,_=prep(D,"SELECT * FROM t1"); lib.sqlite3_step(S); check("close.test:close-1.4.1",lib.sqlite3_close_v2(D),OK); check("close.test:close-1.4.2",(lib.sqlite3_step(S),lib.sqlite3_column_text(S,0)),(ROW,b"two")); rc,X,_=prep(D,"SELECT * FROM sqlite_master"); check("close.test:close-1.4.3",(rc,bool(X)),(MISUSE,False)); check("close.test:close-1.4.4",lib.sqlite3_finalize(S),OK)
# tails/errors
D=opendb(gen/"empty.db"); rc,S,t=prep(D,"SELECT name FROM sqlite_master"); check("capi3c.test:capi3c-1.1",(rc,t),(OK,"")); lib.sqlite3_finalize(S)
rc,S,t=prep(D,"SELECT name FROM sqlite_master;SELECT 10"); check("capi3c.test:capi3c-1.4",(rc,t),(OK,"SELECT 10")); lib.sqlite3_finalize(S); rc,S,t=prep(D,"SELECT namex FROM sqlite_master"); check("capi3c.test:capi3c-1.5",(rc,bool(S)),(1,False))
# Native-endian prepare16 tails (upstream capi3c-2.x harness-only cases).
def prep16(sql):
 raw=(sql+"\0").encode("utf-16-le" if sys.byteorder=="little" else "utf-16-be"); buf=C.create_string_buffer(raw); s=P(); tail=P(); rc=lib.sqlite3_prepare16_v2(D,C.cast(buf,P),-1,C.byref(s),C.byref(tail)); off=(tail.value-C.addressof(buf)) if tail.value else 0; suffix=raw[off:-2].decode("utf-16-le" if sys.byteorder=="little" else "utf-16-be") if rc==OK else None; return rc,s,suffix
rc,S,t=prep16("SELECT name FROM sqlite_master"); check("capi3c.test:capi3c-2.1",(rc,t),(OK,"")); lib.sqlite3_finalize(S)
rc,S,t=prep16("SELECT name FROM sqlite_master;SELECT 10"); check("capi3c.test:capi3c-2.2",(rc,t),(OK,"SELECT 10")); lib.sqlite3_finalize(S)
rc,S,t=prep16("SELECT namex FROM sqlite_master"); check("capi3c.test:capi3c-2.3",(rc,bool(S)),(1,False)); lib.sqlite3_close(D)
# names, reset/clear/finalize, and lossless values
D=opendb(gen/"bind.db"); _,S,_=prep(D,"SELECT $one,$::two,$x(-z-)")
check("bind.test:bind-2.1.1",lib.sqlite3_bind_parameter_count(S),3)
for ref,i,name in [("bind.test:bind-2.1.2",1,b"$one"),("bind.test:bind-2.1.3",2,b"$::two"),("bind.test:bind-2.1.4",3,b"$x(-z-)")]: check(ref,lib.sqlite3_bind_parameter_name(S,i),name)
for ref,name,i in [("bind.test:bind-2.1.5",b"$one",1),("bind.test:bind-2.1.6",b"$::two",2),("bind.test:bind-2.1.7",b"$x(-z-)",3),("bind.test:bind-2.1.8",b":hi",0)]: check(ref,lib.sqlite3_bind_parameter_index(S,name),i)
for i,v in enumerate((32,-2000000000000,2000000000000),1): lib.sqlite3_bind_int64(S,i,v)
check("bind.test:bind-3.1",(lib.sqlite3_step(S),[lib.sqlite3_column_int64(S,i) for i in range(3)]),(ROW,[32,-2000000000000,2000000000000]))
lib.sqlite3_reset(S); check("bind-reset-retains",(lib.sqlite3_reset(S),lib.sqlite3_step(S),[lib.sqlite3_column_int64(S,i) for i in range(3)]),(OK,ROW,[32,-2000000000000,2000000000000])); lib.sqlite3_reset(S)
check("bind-clear-to-null",lib.sqlite3_clear_bindings(S),OK); check("bind-clear-observation",(lib.sqlite3_step(S),[lib.sqlite3_column_type(S,i) for i in range(3)]),(ROW,[5,5,5])); check("bind-finalize",lib.sqlite3_finalize(S),OK)
_,S,_=prep(D,"SELECT ?,?,?")
for i,v in enumerate((-9223372036854775808,9223372036854775807,0),1): lib.sqlite3_bind_int64(S,i,v)
check("transport:int64-extrema",(lib.sqlite3_step(S),[lib.sqlite3_column_int64(S,i) for i in range(2)]),(ROW,[-9223372036854775808,9223372036854775807])); lib.sqlite3_finalize(S)
_,S,_=prep(D,"SELECT ?,?,?,?")
for i,v in enumerate((4500000000000000.0,float("nan"),float("inf"),float("-inf")),1): lib.sqlite3_bind_double(S,i,v)
lib.sqlite3_step(S); check("transport:real-specials",([lib.sqlite3_column_type(S,i) for i in range(4)],[fhex(lib.sqlite3_column_double(S,i)) if i!=1 else None for i in range(4)]),([2,5,2,2],["432ff973cafa8000",None,"7ff0000000000000","fff0000000000000"])); lib.sqlite3_finalize(S)
_,S,_=prep(D,"SELECT ?,?,?"); empty=C.create_string_buffer(b"\0"); raw=C.create_string_buffer(b"\x00\xff\x80")
lib.sqlite3_bind_null(S,1); lib.sqlite3_bind_text(S,2,C.cast(empty,C.c_char_p),0,P(-1)); lib.sqlite3_bind_blob(S,3,C.cast(raw,P),0,P(-1)); lib.sqlite3_step(S)
check("transport:null-empty-text-empty-blob",([lib.sqlite3_column_type(S,i) for i in range(3)],lib.sqlite3_column_bytes(S,1),lib.sqlite3_column_bytes(S,2)),([5,3,4],0,0)); lib.sqlite3_finalize(S)
_,S,_=prep(D,"SELECT ?"); lib.sqlite3_bind_blob(S,1,C.cast(raw,P),3,P(-1)); lib.sqlite3_step(S); check("transport:blob-00ff80",blob(S,0),b"\x00\xff\x80"); lib.sqlite3_finalize(S)
_,S,_=prep(D,"SELECT 1 AS x,2 AS x"); check("transport:duplicate-ordered-columns",[lib.sqlite3_column_name(S,i) for i in range(2)],[b"x",b"x"]); lib.sqlite3_finalize(S); lib.sqlite3_close(D)
# metadata/types + encodings/read-only
D=opendb(gen/"meta.db"); _,S,_=prep(D,"SELECT a,b,c FROM t1"); check("capi3c.test:capi3c-5.0",lib.sqlite3_column_count(S),3); check("capi3c.test:capi3c-5.1.1",[lib.sqlite3_column_name(S,i) for i in range(3)],[b"a",b"b",b"c"]); check("capi3c.test:capi3c-5.1.3",[lib.sqlite3_column_name(S,i) for i in range(3)],[b"a",b"b",b"c"]); check("capi3c.test:capi3c-5.1.5",[lib.sqlite3_column_decltype(S,i) for i in range(3)],[b"VARINT",b"BLOB",b"VARCHAR(16)"]); check("capi3c.test:capi3c-5.1.8",[lib.sqlite3_column_database_name(S,i) for i in range(3)],[b"main"]*3); check("capi3c.test:capi3c-5.1.10",[lib.sqlite3_column_table_name(S,i) for i in range(3)],[b"t1"]*3); check("capi3c.test:capi3c-5.1.12",[lib.sqlite3_column_origin_name(S,i) for i in range(3)],[b"a",b"b",b"c"]); check("capi3c.test:capi3c-5.2",lib.sqlite3_step(S),ROW); check("capi3c.test:capi3c-5.4.1",[lib.sqlite3_column_type(S,i) for i in range(3)],[1,1,3]); lib.sqlite3_finalize(S); lib.sqlite3_close(D)
for ident in ("encoding-utf8","encoding-utf16le","encoding-utf16be"):
 D=opendb(gen/(ident+".db")); _,S,_=prep(D,"SELECT a,b,c FROM t1"); check("enc2.test:"+{"encoding-utf8":"enc2-1.1","encoding-utf16le":"enc2-2.1","encoding-utf16be":"enc2-3.1"}[ident],(lib.sqlite3_step(S),lib.sqlite3_column_text(S,0),lib.sqlite3_column_text(S,1)),(ROW,b"one",b"I")); lib.sqlite3_finalize(S); lib.sqlite3_close(D)
D=opendb(gen/"readonly.db"); _,S,_=prep(D,"SELECT a,b FROM t1 ORDER BY a"); vals=[]
while lib.sqlite3_step(S)==ROW: vals += [lib.sqlite3_column_int64(S,0),lib.sqlite3_column_int64(S,1)]
check("readonly.test:readonly-1.2",vals,[1,2,3,4,5,6]); lib.sqlite3_finalize(S); lib.sqlite3_close(D)
for x in seen: print(json.dumps(x,separators=(",",":")))
upstream_count=sum(1 for x in seen if x["ref"] in set(json.loads((root.parent/"conformance/cases/stage2-initial.json").read_text())["upstreamCases"]))
companion_count=sum(1 for x in seen if x["ref"] in set(json.loads((root.parent/"conformance/cases/stage2-initial.json").read_text())["companionCases"]))
print(json.dumps({"summary":{"oraclePassed":upstream_count,"companionPassedNoCredit":companion_count,"oracleObservations":upstream_count+companion_count,"tsPassed":0,"tsUnimplemented":upstream_count,"tsCompanionUnimplementedNoCredit":companion_count,"engine":"unimplemented"}},separators=(",",":")))
