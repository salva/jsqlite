"""Pinned development-only C API capture for raw label regressions; no runtime dependency."""
import ctypes as c
import json
import pathlib
import re
import sys
lib=c.CDLL(sys.argv[1]); P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name); f.argtypes=args; f.restype=ret
source=lib.sqlite3_sourceid().decode()
assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
db=P(); assert lib.sqlite3_open(b':memory:',c.byref(db))==0
rows=[]
for expression,expected in re.findall(r'\["([^"]+)",(null|\x27[^\x27]*\x27)\]',pathlib.Path('test/conformance/json-mergepatch-raw-label.test.mjs').read_text()):
 stmt=P(); assert lib.sqlite3_prepare_v2(db,('SELECT '+expression).encode(),-1,c.byref(stmt),None)==0
 rc=lib.sqlite3_step(stmt)
 row={'expression':expression,'step':rc}
 if rc==100: row.update(type=lib.sqlite3_column_type(stmt,0),value=lib.sqlite3_column_text(stmt,0).decode())
 else: row.update(error=lib.sqlite3_errmsg(db).decode())
 lib.sqlite3_finalize(stmt);rows.append(row)
 want=None if expected=='null' else expected[1:-1]
 assert (rc==1 and row['error']=='malformed JSON') if want is None else (rc==100 and row['type']==3 and row['value']==want),row
lib.sqlite3_close(db)
out={'sourceId':source,'cases':rows}
pathlib.Path('docs/research/card-r-b-raw-label-native.json').write_text(json.dumps(out,indent=2)+'\n')
print(source);print(len(rows),'native expectations verified')
