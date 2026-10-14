#!/usr/bin/env python3
"""Pinned native nonempty TVF origin/binding controls; disposable files in --work."""
import argparse,base64,ctypes as C,hashlib,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[3]
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--work',required=True);args=a.parse_args()
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n);d=n.load(args.library)
pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId'];assert d.sqlite3_sourceid().decode()==pin
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
work=pathlib.Path(args.work);work.mkdir(parents=True,exist_ok=True)
queries=[('SELECT * FROM pragma_database_list',[[],[]]),('SELECT p.seq,p.name,p.file FROM pragma_database_list() p',[[],[]])]
out={'sourceId':pin,'encodings':[]}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=work/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 n.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE t(id INTEGER PRIMARY KEY,a TEXT,p INTEGER REFERENCES parent ON UPDATE CASCADE ON DELETE SET NULL); CREATE INDEX ix ON t(a COLLATE nocase DESC,p); CREATE INDEX ex ON t(lower(a)); CREATE TABLE w(a TEXT,b INT,PRIMARY KEY(a,b)) WITHOUT ROWID; INSERT INTO t VALUES(1,'x',NULL),(2,'y',NULL); CREATE TABLE u(z BLOB,q REAL); CREATE VIEW cycle AS SELECT * FROM cycle;");d.sqlite3_close(db)
 b=p.read_bytes();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for sql,runs in queries:
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  names=['name','decltype','database_name','table_name','origin_name'];keys=['name','declaredType','database','table','origin']
  meta=[{k:(getattr(d,'sqlite3_column_'+f)(st,i).decode() if getattr(d,'sqlite3_column_'+f)(st,i) is not None else None) for k,f in zip(keys,names)} for i in range(d.sqlite3_column_count(st))]
  results=[]
  for bindings in runs:
   d.sqlite3_reset(st);d.sqlite3_clear_bindings(st)
   for i,v in enumerate(bindings,1):
    rc=d.sqlite3_bind_null(st,i) if v is None else d.sqlite3_bind_int64(st,i,v) if isinstance(v,int) else d.sqlite3_bind_text(st,i,v.encode(),-1,C.c_void_p(-1));assert rc==0
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==101:break
    assert rc==100,(sql,rc)
    row=[]
    for i in range(d.sqlite3_column_count(st)):
     t=d.sqlite3_column_type(st,i)
     if t==5:v=None
     elif t==1:v=str(d.sqlite3_column_int64(st,i))
     elif t==3:v=C.string_at(d.sqlite3_column_text(st,i),d.sqlite3_column_bytes(st,i)).decode()
     else:raise AssertionError(t)
     row.append({'type':t,'value':v})
    rows.append(row)
   results.append({'bindings':bindings,'rows':rows})
  d.sqlite3_finalize(st);cases.append({'sql':sql,'metadata':meta,'runs':results})
 d.sqlite3_close(db);out['encodings'].append({'encoding':enc,'base64':base64.b64encode(b).decode(),'sha256':hashlib.sha256(b).hexdigest(),'cases':cases})
pathlib.Path(__file__).with_name('tvf-db-native.json').write_text(json.dumps(out,indent=2)+'\n')
print('pinned five-TVF capture complete')
