"""Exact pinned read-only trigger Window field-order controls; card work only."""
import ctypes as C
import importlib.util
import pathlib
import json
import hashlib
import os
r=pathlib.Path.cwd()
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'trigger-walker-red'
w.mkdir(parents=True,exist_ok=True)
s=importlib.util.spec_from_file_location('n',r/'test/conformance/capture-index-planner.py')
n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
pin=json.loads((r/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
d.sqlite3_errmsg.restype=C.c_char_p
cases=[
 ('order-filter','sum(a) FILTER (WHERE (SELECT a FROM filterdb.t)) OVER (ORDER BY (SELECT a FROM orderdb.t))','orderdb'),
 ('partition-filter','sum(a) FILTER (WHERE (SELECT a FROM filterdb.t)) OVER (PARTITION BY (SELECT a FROM partdb.t))','partdb'),
 ('order-partition','sum(a) FILTER (WHERE 1) OVER (PARTITION BY (SELECT a FROM partdb.t) ORDER BY (SELECT a FROM orderdb.t))','orderdb'),
 ('filter-frame','sum(a) FILTER (WHERE (SELECT a FROM filterdb.t)) OVER (ROWS (SELECT a FROM framedb.t) PRECEDING)','filterdb'),
 ('frame-nonconstant','sum(a) FILTER (WHERE 1) OVER (ROWS BETWEEN (SELECT a FROM startdb.t) PRECEDING AND (SELECT a FROM enddb.t) FOLLOWING)',None),
 ('frame-id','sum(a) OVER (ROWS (SELECT a FROM bounddb.t) PRECEDING)',None),
 ('frame-function','sum(a) OVER (ROWS abs((SELECT a FROM bounddb.t)) PRECEDING)',None),
 ('frame-variable','sum(a) OVER (ROWS ? PRECEDING)',None),
 ('frame-constant','sum(a) OVER (ROWS (1+2) PRECEDING)',None),
 ('frame-deep','sum(a) OVER (ROWS '+('('+ '1+'*80+'(SELECT a FROM bounddb.t)'+')')+' PRECEDING)',None),
 ('frame-syntax','sum(a) OVER (ROWS (SELECT FROM bounddb.t) PRECEDING)','syntax'),
 ('filter-only','sum(a) FILTER (WHERE (SELECT a FROM filterdb.t))','filterdb'),
 ('argument-window','sum((SELECT a FROM argdb.t)) FILTER (WHERE (SELECT a FROM filterdb.t)) OVER (ORDER BY (SELECT a FROM orderdb.t))','argdb'),
]
out=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for label,expr,winner in cases:
  p=w/(enc+'-'+label+'.db');p.unlink(missing_ok=True);db=C.c_void_p()
  assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
  definition=f'CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT {expr} FROM t; END'
  sql=f"PRAGMA encoding='{enc}'; CREATE TABLE t(a); CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT 1; END; PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql='{definition}' WHERE name='log';"
  err=C.c_char_p();assert d.sqlite3_exec(db,sql.encode(),None,None,C.byref(err))==0,err.value
  assert d.sqlite3_close(db)==0
  assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,b'SELECT a FROM t',-1,C.byref(st),None)
  msg=d.sqlite3_errmsg(db).decode();assert (rc==0 if winner is None else rc==11 and ('syntax error' in msg if winner=='syntax' else msg.endswith('database '+winner))),(label,rc,msg)
  d.sqlite3_finalize(st);d.sqlite3_close(db)
  out.append(dict(path=str(p),encoding=enc,label=label,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),code=rc,message=msg))
  print(enc,label,rc,msg)
(w/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],cases=out),indent=2))
