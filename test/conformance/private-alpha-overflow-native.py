#!/usr/bin/env python3
"""Development-only pinned SQLite overflow fixture/independent hashed-row capture."""
import ctypes as C,hashlib,importlib.util,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('native',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(sys.argv[1]);pin=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);p=out/'overflow.sqlite';assert not p.exists()
db=h.P();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
try:
 sql="""PRAGMA page_size=4096; CREATE TABLE payload(id INTEGER PRIMARY KEY,k INTEGER,txt TEXT,b BLOB,r REAL,n TEXT); CREATE INDEX payload_k ON payload(k); WITH RECURSIVE x(i) AS(VALUES(1) UNION ALL SELECT i+1 FROM x WHERE i<256) INSERT INTO payload SELECT i,257-i,printf('%.*c',16384,'x')||'é',zeroblob(16384),i+0.25,NULL FROM x;"""
 ep=C.c_char_p();assert d.sqlite3_exec(db,sql.encode(),None,None,C.byref(ep))==0
finally: assert d.sqlite3_close(db)==0
# Reopen READONLY before capturing; no TS result participates in expectations.
d.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(h.P),C.c_int,C.c_char_p];assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
st=h.P();sql='SELECT id,k,txt,b,r,n FROM payload INDEXED BY payload_k WHERE k>=1 AND k<=256 ORDER BY k'
try:
 raw=sql.encode();tail=C.c_char_p();assert d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(st),C.byref(tail))==0
 fields=['name','declaredType','database','table','origin'];fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
 metadata=[dict(zip(fields,[h.txt(fn,st,i) for fn in fns])) for i in range(6)]
 rc,rows=h.rows(d,st,6);assert rc==101;assert d.sqlite3_reset(st)==0;rc,again=h.rows(d,st,6);assert rc==101 and again==rows
 for row in rows:
  for c in row:
   key='hex' if c['type']=='blob' else 'utf8Hex' if c['type']=='text' else None
   if key:
    raw=bytes.fromhex(c.pop(key));c.update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
 capture={'sourceId':pin['sqliteSourceId'],'fixtureSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'fixtureBytes':p.stat().st_size,'sql':sql,'metadata':metadata,'rows':rows}
 (out/'overflow-native.json').write_text(json.dumps(capture,indent=2)+'\n')
finally: assert d.sqlite3_finalize(st)==0;assert d.sqlite3_close(db)==0
