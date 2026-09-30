#!/usr/bin/env python3
"""Pinned read-only selected-access discriminators; --update explicitly refreshes captures."""
import argparse, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('index_capture',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(p);p.loader.exec_module(m)
source=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
out=ROOT/'test/conformance/cases/selected-in-integration-native.json'
CASES=[
 ('triple-first','advanced-index','SELECT id,a,b,c FROM m INDEXED BY m_abc WHERE a IN (?1,?2,NULL) AND b IN (3,2,1) AND c IN (5,4,3,2,1,NULL)',[2,1]),
 ('triple-rebound','advanced-index','SELECT id,a,b,c FROM m INDEXED BY m_abc WHERE a IN (?1,?2,NULL) AND b IN (3,2,1) AND c IN (5,4,3,2,1,NULL)',[3,1]),
 ('triple-left','advanced-index','SELECT x.id,y.id FROM m x LEFT JOIN m y INDEXED BY m_abc ON y.a IN (x.a,x.a,NULL) AND y.b IN (3,2,1) AND y.c IN (5,4,3,2,1,NULL) AND y.id=x.id WHERE x.id IN (1,2,3,4,5) ORDER BY x.id,y.id',[]),
 ('triple-left-unmatched','advanced-index','SELECT x.id,y.id FROM m x LEFT JOIN m y INDEXED BY m_abc ON y.a IN (x.a,x.a,NULL) AND y.b IN (3,2,1) AND y.c IN (5,4,3,2,1,NULL) AND y.id=x.id+100 WHERE x.id IN (1,2,3,4,5) ORDER BY x.id,y.id',[]),
 ('desc-in','index-planner',"SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b IN ('alpha','beta','gamma')",[]),
 ('desc-range','index-planner',"SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b>='a' AND b<'z'",[]),
 ('desc-range-open-closed','index-planner',"SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b>'alpha' AND b<='gamma'",[]),
 ('desc-range-empty','index-planner',"SELECT rowid,a,b FROM t INDEXED BY ix_ab_desc WHERE a IN (2,1,NULL) AND b>'z' AND b<'a'",[]),
]
def rebound(d,db,sql):
 """One prepared cursor: done, reset, clear, bind, step, reset, rebind."""
 st=m.C.c_void_p()
 assert d.sqlite3_prepare_v2(db,sql.encode(),-1,m.C.byref(st),None)==m.OK
 runs=[]
 try:
  for values in ([2,1],[3,1],[None,2]):
   assert d.sqlite3_reset(st)==m.OK
   assert d.sqlite3_clear_bindings(st)==m.OK
   m.bind(d,st,values)
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==m.DONE:break
    assert rc==m.ROW, f'native rebound step {rc}'
    rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   runs.append(dict(bindings=values,rows=rows,fullscanSteps=d.sqlite3_stmt_status(st,m.FULLSCAN_STEP,1)))
 finally:assert d.sqlite3_finalize(st)==m.OK
 return runs
def capture(library):
 d=m.load(library)
 assert (d.sqlite3_libversion().decode(),d.sqlite3_sourceid().decode())==(source['version'],source['sqliteSourceId']), 'not manifest-pinned native SQLite'
 variants=[]
 for encoding in ('utf8','utf16le','utf16be'):
  cases=[]; lifecycle=None
  for name,fixture,sql,bindings in CASES:
   path=ROOT/f'test/conformance/fixtures/{fixture}-{encoding}.db'
   raw=path.read_bytes();db=m.C.c_void_p()
   assert d.sqlite3_open_v2(str(path).encode(),m.C.byref(db),m.SQLITE_OPEN_READONLY,None)==m.OK
   try:
    rows,work=m.query(d,db,sql,bindings)
    eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,bindings)
    ops=m.explain(d,db,'EXPLAIN ',sql,bindings)
    if name=='triple-first':lifecycle=rebound(d,db,sql)
   finally:assert d.sqlite3_close(db)==m.OK
   cases.append(dict(name=name,fixture=str(path.relative_to(ROOT)),sha256=hashlib.sha256(raw).hexdigest(),sql=sql,bindings=bindings,rows=rows,eqp=eqp,ops=ops,work=work))
  variants.append(dict(encoding=encoding,cases=cases,lifecycle=lifecycle))
 return dict(sourceId=source['sqliteSourceId'],schema='selected-in-integration-native/1',variants=variants)
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--update',action='store_true');args=a.parse_args()
 actual=capture(args.library)
 if args.update:out.write_text(json.dumps(actual,indent=2,ensure_ascii=False)+'\n')
 else:assert actual==json.loads(out.read_text()), 'pinned read-only capture changed'
 print('pinned read-only integration capture matches:',len(actual['variants']),'encodings')
