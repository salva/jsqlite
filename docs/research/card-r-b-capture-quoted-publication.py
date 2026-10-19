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
prior=json.loads((root/'card-r-b-quoted-path-native.json').read_text())['cases']
sqls=[r['sql'] for r in prior]
# Retain original BLOB-cast SQL AND true TEXT controls independent of encoding.
import re
textsqls=[re.sub(r"CAST\(x'([0-9a-f]+)' AS TEXT\)",lambda m:"'"+bytes.fromhex(m[1]).decode('utf-8',errors='surrogatepass').replace("'","''")+"'",sql) for sql in sqls]
# Surrogate path is represented as ASCII backslash-u, not a host surrogate.
suites={'quoted':sqls+textsqls}
# Nonminimal object header and raw/TEXTJ/TEXT5 labels, independent of text parser.
# JSONB object payload = label header + a\\u0062 (or TEXT5 a\\vb) + INTEGER 7.
for blob in ['cc0a78615c75303036321337','dc000a78615c75303036321337',
             'cc0759615c76621337','cc044761621337']:
 for path in ['$.ab','$."a\\\\u0062"','$."a\\\\vb"','$.missing']:
  for function in ['json_extract','json_set','json_remove','jsonb_set']:
   value=f"x'{blob}'"
   tail=',9' if function.endswith('set') else ''
   expr=f"{function}({value},'{path}'{tail})"
   suites['quoted'].append('SELECT '+('hex('+expr+')' if function.startswith('jsonb') else expr))
# Header delta/overwrite controls: nested ancestors, same-size, growth, shrink,
# deletion, no-op and sequential edits (jsonBlobOverwrite must preserve extent).
for blob in ['cc0a78615c75303036321337','dc000a78615c75303036321337',
             'cb0ccc0a78615c75303036321337']:
 for path in ['$.ab','$[0].ab','$.missing']:
  for value in ['9','12345','null','jsonb(\'[1,2]\')']:
   suites['quoted'].append(f"SELECT hex(jsonb_set(x'{blob}','{path}',{value}))")
 for fn in ['jsonb_remove','jsonb_replace','jsonb_insert']:
  tail='' if fn=='jsonb_remove' else ',9'
  suites['quoted'].append(f"SELECT hex({fn}(x'{blob}','$.ab'{tail}))")
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
