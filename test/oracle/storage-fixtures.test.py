#!/usr/bin/env python3
"""Validate source-backed Stage 3 fixtures with the pinned native SQLite build."""
import ctypes, hashlib, json, os, pathlib, struct, tempfile

ROOT=pathlib.Path(__file__).resolve().parents[2]
fixture_root=ROOT/"test/fixtures"
current=json.loads((fixture_root/"CURRENT.json").read_text())
gen=fixture_root/"generations"/current["generationId"]
cat=json.loads((gen/"catalog.json").read_text())
by_id={e["id"]:e for e in cat["semantic"]["fixtures"]}
manifest=json.loads((ROOT/"reference/sqlite/manifest.json").read_text())
assert cat["semantic"]["sourceId"]==manifest["sqliteSourceId"]
assert len(cat["semantic"]["fixtures"])==20

lib_path=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/"oracle-build/build/libsqlite3-oracle.so"
lib=ctypes.CDLL(str(lib_path)); DB=ctypes.c_void_p
lib.sqlite3_libversion.restype=ctypes.c_char_p
lib.sqlite3_sourceid.restype=ctypes.c_char_p
lib.sqlite3_open_v2.argtypes=[ctypes.c_char_p,ctypes.POINTER(DB),ctypes.c_int,ctypes.c_char_p]
lib.sqlite3_exec.argtypes=[DB,ctypes.c_char_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.POINTER(ctypes.c_char_p)]
lib.sqlite3_close.argtypes=[DB]; lib.sqlite3_free.argtypes=[ctypes.c_void_p]
assert lib.sqlite3_libversion().decode()==manifest["version"]
assert lib.sqlite3_sourceid().decode()==manifest["sqliteSourceId"]
CALLBACK=ctypes.CFUNCTYPE(ctypes.c_int,ctypes.c_void_p,ctypes.c_int,ctypes.POINTER(ctypes.c_char_p),ctypes.POINTER(ctypes.c_char_p))

def query(path,sql):
    db=DB(); rc=lib.sqlite3_open_v2(str(path).encode(),ctypes.byref(db),1,None) # READONLY
    if rc: raise RuntimeError(f"open rc={rc}")
    rows=[]
    @CALLBACK
    def cb(_,n,values,names):
        rows.append(tuple(None if not values[i] else values[i].decode("utf-8") for i in range(n))); return 0
    err=ctypes.c_char_p()
    rc=lib.sqlite3_exec(db,sql.encode(),cb,None,ctypes.byref(err))
    message=err.value.decode(errors="replace") if err.value else ""
    if err: lib.sqlite3_free(err)
    close_rc=lib.sqlite3_close(db)
    if rc or close_rc: raise RuntimeError(f"exec rc={rc} close={close_rc}: {message}")
    return rows

def rejects_or_not_ok(path):
    try: return query(path,"PRAGMA integrity_check") != [("ok",)]
    except RuntimeError: return True

sizes=(512,1024,2048,4096,8192,16384,32768,65536)
for size in sizes:
    ident=f"storage-p{size}"; e=by_id[ident]; p=gen/e["path"]; data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()==e["sha256"]
    assert data[:16]==b"SQLite format 3\0"
    encoded=struct.unpack(">H",data[16:18])[0]
    assert (65536 if encoded==1 else encoded)==size
    assert data[20]==0
    assert struct.unpack(">I",data[56:60])[0]==1
    assert len(data)%size==0
    assert query(p,"PRAGMA integrity_check")==[("ok",)]
    assert query(p,"PRAGMA page_size")==[(str(size),)]
    assert query(p,"SELECT id,i,typeof(r),length(t),length(b) FROM storage_values WHERE k='overflow'")==[("0","0","real",str(size*4+74),str(size*3+19))]
    assert query(p,"SELECT id,i FROM storage_values WHERE id IN (-9223372036854775808,9223372036854775807) ORDER BY id")==[("-9223372036854775808","-9223372036854775808"),("9223372036854775807","9223372036854775807")]
    assert query(p,"SELECT count(*) FROM storage_values INDEXED BY storage_k WHERE k BETWEEN 'key-000001' AND 'key-002000'")==[("2000",)]

for ident,code in (("storage-p4096",1),("storage-p4096-utf16le",2),("storage-p4096-utf16be",3)):
    assert struct.unpack(">I",(gen/by_id[ident]["path"]).read_bytes()[56:60])[0]==code

def varint(data,off):
    value=0
    for n in range(1,10):
        b=data[off+n-1]
        if n==9: return (value<<8)|b,n
        value=(value<<7)|(b&127)
        if b<128: return value,n
    raise AssertionError("invalid varint")

def overflow_for_rowid_zero(data,page_size):
    def visit(pgno):
        off=(pgno-1)*page_size; h=100 if pgno==1 else 0; typ=data[off+h]; count=struct.unpack(">H",data[off+h+3:off+h+5])[0]
        if typ==5:
            for i in range(count):
                cp=struct.unpack(">H",data[off+h+12+2*i:off+h+14+2*i])[0]
                found=visit(struct.unpack(">I",data[off+cp:off+cp+4])[0])
                if found: return found
            return visit(struct.unpack(">I",data[off+h+8:off+h+12])[0])
        assert typ==13
        for i in range(count):
            cp=struct.unpack(">H",data[off+h+8+2*i:off+h+10+2*i])[0]; p,n1=varint(data,off+cp); row,n2=varint(data,off+cp+n1)
            if row==0:
                usable=page_size; minimum=((usable-12)*32)//255-23; maximum=usable-35
                local=minimum+(p-minimum)%(usable-4) if p>maximum else p
                if local>maximum: local=minimum
                assert p>local
                return struct.unpack(">I",data[off+cp+n1+n2+local:off+cp+n1+n2+local+4])[0]
        return None
    return visit(2)

with tempfile.TemporaryDirectory() as td:
    original=(gen/by_id["storage-p512"]["path"]).read_bytes()
    overflow_page=overflow_for_rowid_zero(original,512); assert overflow_page
    loop=bytearray(original); off=(overflow_page-1)*512; loop[off:off+4]=struct.pack(">I",overflow_page)
    cases={"bad-page-size":original[:16]+b"\x02\x01"+original[18:],
           "reserved-byte":original[:20]+b"\x01"+original[21:],
           "truncated-page":original[:-1],"overflow-self-loop":bytes(loop)}
    for name,data in cases.items():
        p=pathlib.Path(td)/f"{name}.db"; p.write_bytes(data); assert rejects_or_not_ok(p),name

print(f"stage3 storage fixtures verified by pinned SQLite {lib.sqlite3_libversion().decode()}: 18 total, 8 page sizes, 3 encodings, exact int64/index/overflow, 4 malformed companions")
