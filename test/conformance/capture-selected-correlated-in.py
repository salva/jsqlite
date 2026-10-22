#!/usr/bin/env python3
"""Pinned native receipts for the correlated selected-vector regression."""
import argparse, ctypes as C, importlib.util, json, pathlib, sys
sys.dont_write_bytecode=True
s=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('capture-index-planner.py'))
o=importlib.util.module_from_spec(s);s.loader.exec_module(o)
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
d=o.load(args.library)
pin=json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];assert d.sqlite3_libversion().decode()==pin['version']
setup='CREATE TABLE outer_t(k);INSERT INTO outer_t VALUES(1),(2),(3);CREATE TABLE t(id INTEGER PRIMARY KEY,a,b,c);CREATE INDEX t_ab ON t(a,b,c);INSERT INTO t VALUES(1,1,2,3),(2,2,2,4),(3,3,3,5);CREATE TABLE rhs(k,x,y);INSERT INTO rhs VALUES(1,1,2),(2,2,2),(2,2,2),(3,NULL,3);'
sql='SELECT o.k,t.id FROM outer_t AS o CROSS JOIN t INDEXED BY t_ab WHERE (t.a,t.b) IN(SELECT x,y FROM rhs WHERE rhs.k=o.k) AND t.c>=2 ORDER BY o.k,t.id'
root=pathlib.Path(args.output);root.mkdir(parents=True,exist_ok=True)
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=root/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 o.execsql(d,db,"PRAGMA encoding='%s'"%enc);o.execsql(d,db,setup);assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 rows,_=o.query(d,db,sql);ops,_=o.query(d,db,'EXPLAIN '+sql);assert d.sqlite3_close(db)==0
 assert any(bytes.fromhex(row[1].get('utf8Hex','')).decode()=='SeekGE' for row in ops)
 (root/(enc+'.json')).write_text(json.dumps(dict(sql=sql,rows=rows,ops=ops,sourceid=d.sqlite3_sourceid().decode())))
 print(enc,rows)
