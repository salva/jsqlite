#!/usr/bin/env python3
"""Generate R1 oracle snapshots with the manifest-pinned native library only."""
import argparse, ctypes as C, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
parser=argparse.ArgumentParser();parser.add_argument('--library',required=True);parser.add_argument('--output-dir',required=True);args=parser.parse_args()
d=m.load(args.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
d.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];d.sqlite3_column_name.restype=C.c_char_p
d.sqlite3_column_decltype.argtypes=[C.c_void_p,C.c_int];d.sqlite3_column_decltype.restype=C.c_char_p
root=pathlib.Path(args.output_dir).resolve();root.mkdir(parents=True,exist_ok=True);out=[]
queries=['id+1=?1','?1=id+1','a+1=?1','+id=?1','CAST(id AS INTEGER)=?1','abs(id)=?1','id=a','a=b','id IN (99,a)','id=?1','a=?1','(a+1)=?1','(a+2)=?1']
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 f=root/(enc+'.sqlite');f.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(f).encode(),C.byref(db))==0
 m.execsql(d,db,f"PRAGMA encoding='{enc}'; CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER); INSERT INTO t VALUES(1,1,1),(2,4,4),(3,2,5); CREATE INDEX t_a ON t(a); CREATE INDEX t_expr ON t(a+1);")
 cases=[]
 for condition in queries:
  for hint in ['', ' INDEXED BY t_a', ' INDEXED BY t_expr']:
   sql='SELECT id,a,b FROM t'+hint+' WHERE '+condition+' ORDER BY id';runs=[]
   for value in [2,3]:
    params=[value] if '?1' in condition else [];rows,counters=m.query(d,db,sql,params);runs.append(dict(params=params,rows=rows,nativeCounters=counters))
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
   metadata=[dict(name=d.sqlite3_column_name(st,i).decode(),declaredType=d.sqlite3_column_decltype(st,i).decode()) for i in range(3)];d.sqlite3_finalize(st)
   cases.append(dict(sql=sql,params=runs[0]['params'],rows=runs[0]['rows'],runs=runs,metadata=metadata))
 errors=[]
 for sql in ['SELECT id FROM t INDEXED BY missing WHERE id+1=2','SELECT missing FROM t WHERE id=a']:
  st=C.c_void_p();code=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert code!=0;errors.append(dict(sql=sql,code=code,message=d.sqlite3_errmsg(db).decode()))
 d.sqlite3_close(db);out.append(dict(encoding=enc,fixture=str(f),cases=cases,errors=errors))
(root/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],variants=out)))
print('Pinned native capture: 117 queries, 234 independent executions')
