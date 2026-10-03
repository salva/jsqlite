#!/usr/bin/env python3
"""R2 order discriminators, independently captured with the manifest pin."""
import argparse,ctypes as C,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output-dir',required=True);args=p.parse_args()
d=m.load(args.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
for name in ['sqlite3_column_name','sqlite3_column_decltype']:
 f=getattr(d,name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
root=pathlib.Path(args.output_dir).resolve();root.mkdir(parents=True,exist_ok=True);variants=[]
queries=['SELECT k FROM p NOT INDEXED ORDER BY k','SELECT k,v FROM cp NOT INDEXED ORDER BY k,v','SELECT id FROM t NOT INDEXED ORDER BY id','SELECT id FROM t NOT INDEXED ORDER BY id DESC','SELECT -id AS id FROM t ORDER BY id','SELECT -a AS a FROM t INDEXED BY t_a ORDER BY a']
for order in ['a','a ASC','a DESC','a ASC NULLS FIRST','a ASC NULLS LAST','a DESC NULLS FIRST','a DESC NULLS LAST']:
 queries.append('SELECT id,a FROM t INDEXED BY t_a ORDER BY '+order)
queries+=['SELECT id,a FROM t INDEXED BY t_ab WHERE a=?1 ORDER BY b','SELECT -id AS id FROM t ORDER BY 1','SELECT id FROM t ORDER BY t.id','SELECT id FROM t ORDER BY (id)','SELECT a FROM t INDEXED BY t_a ORDER BY a COLLATE BINARY','SELECT k FROM p NOT INDEXED ORDER BY k COLLATE NOCASE']
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 file=root/(enc+'.sqlite');file.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(file).encode(),C.byref(db))==0
 m.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE p(k TEXT PRIMARY KEY,v); INSERT INTO p VALUES('z',1),('a',2); CREATE TABLE cp(k TEXT,v INTEGER,PRIMARY KEY(k,v)); INSERT INTO cp VALUES('z',1),('a',2),('a',1); CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER); INSERT INTO t VALUES(1,2,3),(2,NULL,2),(3,1,4),(4,3,1); CREATE INDEX t_a ON t(a); CREATE INDEX t_ab ON t(a,b);")
 cases=[]
 for sql in queries:
  runs=[]
  for value in [2,1]:
   params=[value] if '?1' in sql else [];rows,counters=m.query(d,db,sql,params);runs.append(dict(params=params,rows=rows,nativeCounters=counters))
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  metadata=[dict(name=d.sqlite3_column_name(st,i).decode(),declaredType=(d.sqlite3_column_decltype(st,i).decode() if d.sqlite3_column_decltype(st,i) else None)) for i in range(d.sqlite3_column_count(st))];d.sqlite3_finalize(st)
  cases.append(dict(sql=sql,runs=runs,metadata=metadata))
 errors=[]
 for sql in ['SELECT id FROM t ORDER BY 9','SELECT id FROM t ORDER BY id COLLATE missing']:
  st=C.c_void_p();code=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert code!=0;errors.append(dict(sql=sql,code=code,message=d.sqlite3_errmsg(db).decode()))
 d.sqlite3_close(db);variants.append(dict(encoding=enc,fixture=str(file),cases=cases,errors=errors))
(root/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],variants=variants)));print('Pinned R2 capture: 57 queries/114 executions and 6 errors')
