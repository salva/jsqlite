#!/usr/bin/env python3
"""Validate frozen adapted join8 files read-only, independent of setup capture."""
import ctypes as C, hashlib, importlib.util, json, os, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
m=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
d.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(h.P),C.c_int,C.c_char_p]
base=json.loads((root/'test/conformance/cases/repeated-upstream-join8.json').read_text())
u=json.loads((root/'test/conformance/cases/repeated-upstream-join8-utf16.json').read_text())
fixtures={'utf8':{'path':'repeated-upstream-join8.db','sha256':base['fixtureSha256']},**u['fixtures']}
cases=[dict(c,encoding='utf8') for c in base['cases']]+u['cases']
for enc,fixture in fixtures.items():
 path=root/'test/conformance/fixtures'/fixture['path'];before=hashlib.sha256(path.read_bytes()).hexdigest();assert before==fixture['sha256']
 db=h.P();assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 try:
  for c in (c for c in cases if c['encoding']==enc):
   st=h.P();raw=c['sql'].encode();tail=C.c_char_p()
   assert d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(st),C.byref(tail))==0,c['id']
   try:
    n=d.sqlite3_column_count(st)
    fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
    columns=[dict(zip(['name','declType','database','table','origin'],[h.txt(f,st,i) for f in fns])) for i in range(n)]
    assert columns==c['native']['columns'],(enc,c['id'],'metadata')
    for _ in range(2):
     rc,rows=h.rows(d,st,n);assert rc==101 and rows==c['native']['first']['rows'],(enc,c['id'],'rows');assert d.sqlite3_reset(st)==0
   finally:assert d.sqlite3_finalize(st)==0
 finally:assert d.sqlite3_close(db)==0
 assert hashlib.sha256(path.read_bytes()).hexdigest()==before
print('frozen read-only join8 validation:12/12; metadata + typed rows twice across reset; fixture hashes unchanged')
