#!/usr/bin/env python3
"""Development-only pinned stat1 extension snapshots; setup writes, then read-only oracle."""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]
p = importlib.util.spec_from_file_location('capture', ROOT/'test/conformance/capture-in-range-stat.py')
cap = importlib.util.module_from_spec(p); p.loader.exec_module(cap)
m = cap.m
SOURCE = cap.SOURCE
OUT = ROOT/'test/conformance/cases/stat-format-boundary.json'
SQL = {
 'forced': 'SELECT id FROM t INDEXED BY t_a WHERE a=1 AND b IN (13,14) ORDER BY id',
 'unforced': 'SELECT id FROM t WHERE a=1 AND b IN (13,14) ORDER BY id',
}

def capture(library, regenerate=False):
 d = m.load(library); cap.identity(d)
 variants = []
 for enc in ('utf8','utf16le','utf16be'):
  for token in ('sz=4096','noskipscan'):
   source = ROOT/f'test/conformance/fixtures/in-range-stat-{enc}-after.db'
   target = ROOT/f'test/conformance/fixtures/stat-format-{enc}-{token.split("=")[0]}.db'
   if regenerate:
    shutil.copyfile(source,target)
    db = cap.open_db(d,target,False)
    try: m.execsql(d,db,"UPDATE sqlite_stat1 SET stat=stat||' " + token + "' WHERE idx='t_a'")
    finally: d.sqlite3_close(db)
   db = cap.open_db(d,target,True)
   try:
    stat = m.text(m.query(d,db,"SELECT stat FROM sqlite_stat1 WHERE idx='t_a'")[0][0][0])
    assert stat.endswith(' '+token), (target,stat)
    cases = {}
    for name,sql in SQL.items():
     rows,_ = m.query(d,db,sql)
     eqp = m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())
     cases[name]={'rows':rows,'eqp':eqp}
    variants.append({'encoding':enc,'token':token,'fixture':str(target.relative_to(ROOT)),
                     'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
                     'stat':stat,'cases':cases})
   finally: d.sqlite3_close(db)
 return {'sourceId':SOURCE['sqliteSourceId'],'sql':SQL,'variants':variants}

if __name__ == '__main__':
 import argparse
 a=argparse.ArgumentParser(); a.add_argument('--library',required=True); a.add_argument('--regenerate',action='store_true'); args=a.parse_args()
 result=capture(args.library,args.regenerate)
 if args.regenerate: OUT.write_text(json.dumps(result,indent=2)+'\n')
 else:
  assert result==json.loads(OUT.read_text()), 'pinned read-only capture differs'
  print('pinned read-only stat extensions match:',len(result['variants']))
