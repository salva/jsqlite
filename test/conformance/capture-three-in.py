#!/usr/bin/env python3
"""Pinned 3.53.4 read-only three-IN cursor capture on immutable advanced-index images."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('ordinary',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(p);p.loader.exec_module(m)
q=importlib.util.spec_from_file_location('range',ROOT/'test/conformance/capture-in-range-stat.py')
r=importlib.util.module_from_spec(q);q.loader.exec_module(r)
SOURCE=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
OUT=ROOT/'test/conformance/cases/three-in-native.json'
SQL={
 'single':'SELECT id,a,b,c FROM m INDEXED BY m_abc WHERE a IN (?1,?2,NULL) AND b IN (3,2,1) AND c IN (5,4,3,2,1,NULL)',
 'left':'SELECT x.id,y.id FROM m x LEFT JOIN m y INDEXED BY m_abc ON y.a IN (x.a,x.a,NULL) AND y.b IN (3,2,1) AND y.c IN (5,4,3,2,1,NULL) AND y.id=x.id AND y.id<>5 WHERE x.id IN (1,2,3,4,5) ORDER BY x.id,y.id',
 'scan':'SELECT id,a,b,c FROM m NOT INDEXED WHERE a IN (?1,?2,NULL) AND b IN (3,2,1) AND c IN (5,4,3,2,1,NULL)',
}
REBINDS=[[2,1],[3,1]]
def capture(d):
 r.identity(d); variants=[]
 for enc in ('utf8','utf16le','utf16be'):
  f=ROOT/f'test/conformance/fixtures/advanced-index-{enc}.db';db=r.open_db(d,f,True)
  try:
   roots={m.text(row[0]):int(row[1]['value']) for row in m.query(d,db,"SELECT name,rootpage FROM sqlite_schema WHERE name IN ('m','m_abc') ORDER BY name")[0]}
   cases={}
   for name,sql in SQL.items():
    captures=[]
    for params in (REBINDS if name!='left' else [()]):
     rows,counters=m.query(d,db,sql,params)
     vdbe=r.full_vdbe(d,db,sql,params)
     interesting={'OpenRead','OpenEphemeral','IdxInsert','Rewind','Last','Next','Prev','Column','IsNull','SeekGE','SeekGT','SeekLE','SeekLT','IdxGT','IdxGE','IdxLT','IdxLE','NotFound','Found','NullRow','IfPos','SorterOpen','SorterInsert'}
     captures.append({'bindings':list(params),'rows':rows,'counters':counters,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,params),'vdbe':[op for op in vdbe if op['opcode'] in interesting]})
    cases[name]=captures
   variants.append({'encoding':enc,'fixture':str(f.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'roots':roots,'cases':cases})
  finally:d.sqlite3_close(db)
 return {'schema':'jsqlite-three-in-native/1','sourceId':SOURCE['sqliteSourceId'],'sql':SQL,'variants':variants}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--regenerate',action='store_true');args=a.parse_args();actual=capture(m.load(args.library))
 if args.regenerate:OUT.write_text(json.dumps(actual,indent=2)+'\n')
 else:
  if actual!=json.loads(OUT.read_text()):raise SystemExit('frozen three-IN capture differs')
  print('pinned read-only three-IN capture matches',len(actual['variants']),'encodings')
