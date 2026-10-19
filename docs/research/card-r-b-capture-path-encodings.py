"""Pinned development-only per-database-encoding scalar-path oracle.
Usage: python3 ... <libsqlite3.so> <output.json>; retains predecessor SQL inventories.
"""
import ctypes as c
import hashlib
import json
import pathlib
import sys
P = c.c_void_p
lib = c.CDLL(sys.argv[1])
for name, args, ret in [
 ('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),
 ('sqlite3_exec',[P,c.c_char_p,P,P,P],c.c_int),
 ('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),
 ('sqlite3_step',[P],c.c_int),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),
 ('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),
 ('sqlite3_column_blob',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),
 ('sqlite3_column_name',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),
 ('sqlite3_extended_errcode',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name); f.argtypes=args; f.restype=ret
source=lib.sqlite3_sourceid().decode()
assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
root=pathlib.Path(__file__).parent
suites={n:[r['sql'] for r in json.loads((root/f'card-r-b-{n}-native.json').read_text())['cases']] for n in ['arrow','extract']}
# Negative controls distinguish SQL TEXT coercion, BLOB producer encoding,
# quoted raw spans, reached errors and document-first error priority.
extra=["SELECT json_extract('{\"é\":7}','$.'||'é')",
 "SELECT json_extract('{\"a\\nb\":7}','$.'||char(34)||'a'||char(10)||'b'||char(34))",
 "SELECT json_extract('{\"a\\nb\":7}','$.'||char(34)||'a\\xb'||char(34))",
 "SELECT json_extract('bad',NULL)","SELECT json_extract('bad',x'24')",
 "SELECT json_extract('{}',CAST(x'24' AS TEXT))",
 "SELECT json_extract('{}','$[')","SELECT json_extract('{}',1)",
 "SELECT json_extract('{}','$',NULL)","SELECT json_extract('{}','$', '$[')"]
suites['extract']+=extra
out={'sourceId':source,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'encodings':{}}
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 db=P(); assert lib.sqlite3_open(b':memory:',c.byref(db))==0
 assert lib.sqlite3_exec(db,f"PRAGMA encoding='{pragma}'; CREATE TABLE encoding_anchor(x)".encode(),None,None,None)==0
 result={}
 for suite,sqls in suites.items():
  rows=[]
  for sql in sqls:
   stmt=P(); assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,c.byref(stmt),None)==0,sql
   row={'sql':sql,'name':lib.sqlite3_column_name(stmt,0).decode()}
   rc=lib.sqlite3_step(stmt)
   if rc==100:
    typ=lib.sqlite3_column_type(stmt,0)
    if typ==4:
     n=lib.sqlite3_column_bytes(stmt,0); v=c.string_at(lib.sqlite3_column_blob(stmt,0),n).hex().upper()
    elif typ==5: v=None
    else: v=lib.sqlite3_column_text(stmt,0).decode()
    row.update(type={1:'integer',2:'real',3:'text',4:'blob',5:'null'}[typ],value=v)
    assert lib.sqlite3_step(stmt)==101,sql
   else:
    assert rc==1,(sql,rc)
    row.update(error=lib.sqlite3_errmsg(db).decode(),code=rc,extendedCode=lib.sqlite3_extended_errcode(db))
   lib.sqlite3_finalize(stmt); rows.append(row)
  result[suite]=rows
 assert lib.sqlite3_close(db)==0
 out['encodings'][enc]=result
pathlib.Path(sys.argv[2]).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(source, {e:{s:len(r) for s,r in v.items()} for e,v in out['encodings'].items()})
