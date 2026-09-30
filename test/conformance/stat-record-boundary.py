#!/usr/bin/env python3
"""Pinned native stat record boundary snapshots. Writes only with --regenerate."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import shutil
import ctypes as C

ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('base',ROOT/'test/conformance/stat-format-boundary.py')
base=importlib.util.module_from_spec(p);p.loader.exec_module(base)
m=base.m
OUT=ROOT/'test/conformance/cases/stat-record-boundary.json'
STAT4_OUT=ROOT/'test/conformance/cases/stat4-enabled-boundary.json'
# The pinned default library does not compile ENABLE_STAT4. A table with the
# reserved name remains a file-format/admission probe, not STAT4 planner parity.
SETUP={
 'table-only': "INSERT INTO sqlite_stat1(tbl,idx,stat) VALUES('t',NULL,'304')",
 'unknown-table': "INSERT INTO sqlite_stat1(tbl,idx,stat) VALUES('not_a_table','t_a','nonsense')",
 'malformed-number': "UPDATE sqlite_stat1 SET stat='bad 76' WHERE idx='t_a'",
 'stat4-sample': "CREATE TABLE sqlite_stat4(tbl,idx,neq,nlt,ndlt,sample)",
}
def capture(library,regenerate=False,stat4=False):
 d=m.load(library);base.cap.identity(d)
 if stat4:
  d.sqlite3_compileoption_used.argtypes=[C.c_char_p]
  assert d.sqlite3_compileoption_used(b'ENABLE_STAT4')==1,'requires pinned STAT4-enabled library'
 variants=[]
 for enc in ('utf8','utf16le','utf16be'):
  for kind,setup in ({'stat4-analyze': 'ANALYZE t'} if stat4 else SETUP).items():
   source=ROOT/f'test/conformance/fixtures/in-range-stat-{enc}-after.db'
   target=ROOT/f'test/conformance/fixtures/stat4-enabled-{enc}.db' if stat4 else ROOT/f'test/conformance/fixtures/stat-record-{enc}-{kind}.db'
   if regenerate:
    shutil.copyfile(source,target)
    db=base.cap.open_db(d,target,False)
    try:
     if kind=='stat4-sample':
      m.execsql(d,db,'PRAGMA writable_schema=ON')
     m.execsql(d,db,setup)
     if kind=='stat4-sample':m.execsql(d,db,"INSERT INTO sqlite_stat4 VALUES('t','t_a','1','1','1',X'01')")
    finally:d.sqlite3_close(db)
   db=base.cap.open_db(d,target,True)
   try:
    n=m.query(d,db,'SELECT count(*) FROM sqlite_stat1 WHERE idx IS NULL')[0][0][0]
    sample=m.query(d,db,'SELECT count(*) FROM sqlite_stat4')[0][0][0] if stat4 or kind=='stat4-sample' else {'type':'integer','value':'0'}
    stat=m.query(d,db,"SELECT stat FROM sqlite_stat1 WHERE idx='t_a'")[0][0][0]
    if kind=='table-only':assert n['value']=='1'
    if kind=='stat4-sample':assert sample['value']=='1'
    if stat4:assert int(sample['value'])>0
    if kind=='malformed-number':assert m.text(stat)=='bad 76'
    cases={}
    for name,sql in base.SQL.items():
     rows,_=m.query(d,db,sql)
     eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
     cases[name]={'rows':rows,'eqp':eqp}
    variants.append({'encoding':enc,'kind':kind,'fixture':str(target.relative_to(ROOT)),
     'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'nullIndexRows':n,
     'samples':sample,'indexStat':stat,'cases':cases})
   finally:d.sqlite3_close(db)
 return {'sourceId':base.SOURCE['sqliteSourceId'],'sql':base.SQL,'variants':variants}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--regenerate',action='store_true');a.add_argument('--stat4',action='store_true');args=a.parse_args()
 out=STAT4_OUT if args.stat4 else OUT
 result=capture(args.library,args.regenerate,args.stat4)
 if args.regenerate:out.write_text(json.dumps(result,indent=2)+'\n')
 else:
  assert result==json.loads(out.read_text()),'read-only pinned stat-record capture differs'
  print('pinned read-only stat-record cases match:',len(result['variants']))
