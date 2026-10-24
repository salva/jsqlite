#!/usr/bin/env python3
"""Read-only native placement boundary witnesses; never used as a TS backend."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('n',ROOT/'test/conformance/capture-index-planner.py')
n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
d=n.load(sys.argv[1]);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
cases={
 'outer':"SELECT x.id,y.id FROM t x CROSS JOIN tiny z LEFT JOIN t y ON y.a=99 AND y.b=x.b AND y.s='cold' ORDER BY x.id,y.id",
 'in':"SELECT x.id,y.id FROM t x CROSS JOIN tiny z CROSS JOIN t y WHERE y.a IN (NULL,-1,98,99) AND y.b=x.b AND y.s='cold' ORDER BY x.id,y.id",
 'group-outer':"SELECT x.id,r.id,y.id FROM t x CROSS JOIN tiny z CROSS JOIN t r LEFT JOIN t y ON y.a=98 AND y.b=x.b AND y.s='cold' WHERE r.a=99 AND r.b=x.b AND r.s='cold' ORDER BY x.id,r.id,y.id",
 'frame':"SELECT (SELECT count(*) FROM t y WHERE y.a=99 AND y.b=x.b AND y.s='cold') FROM t x CROSS JOIN tiny z WHERE x.id<10 ORDER BY x.id"
}
variants=[]
for enc,family in [(enc,family) for enc in ['UTF-8','UTF-16le','UTF-16be'] for family in ['local','skip']]:
 fixture=ROOT/'docs/research/card-s-h'/ (f'{enc}.db' if family=='local' else f'skiprange-{enc}.db');db=C.c_void_p()
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
 captures=[]
 try:
  selected=cases if family=='local' else {'skip-range':"SELECT x.id,y.id FROM t x CROSS JOIN t y WHERE x.id<3 AND y.b>199 ORDER BY x.id,y.id", 'skip-group':"SELECT x.id,z.id,r.id,y.id FROM t x CROSS JOIN t z CROSS JOIN t r INDEXED BY ab CROSS JOIN t y INDEXED BY ab WHERE x.id<3 AND z.id<3 AND r.b=199 AND r.c=0 AND y.b=198 AND y.c=6 ORDER BY x.id,z.id,r.id,y.id", 'skip-equality':"SELECT x.id,z.id,y.id FROM t x CROSS JOIN t z CROSS JOIN t y INDEXED BY ab WHERE x.id<3 AND z.id<3 AND y.b=199 AND y.c=0 ORDER BY x.id,z.id,y.id"}
  for name,sql in selected.items():
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
   try:
    columns=[]
    for i in range(d.sqlite3_column_count(st)):
     metadata={}
     for key,fn in [('name','sqlite3_column_name'),('declaredType','sqlite3_column_decltype'),('database','sqlite3_column_database_name'),('table','sqlite3_column_table_name'),('origin','sqlite3_column_origin_name')]:
      f=getattr(d,fn);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
      v=f(st,i);metadata[key]=v.decode() if v else None
     columns.append(metadata)
    runs=[]
    for _ in range(2):
     rows=[]
     while (rc:=d.sqlite3_step(st))==100:rows.append([n.cell(d,st,i) for i in range(len(columns))])
     assert rc==101;runs.append(rows);assert d.sqlite3_reset(st)==0
   finally:assert d.sqlite3_finalize(st)==0
   eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[])
   program,_=n.query(d,db,'EXPLAIN '+sql)
   ops=[{'addr':int(r[0]['value']),'opcode':n.text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in program]
   filters=[o for o in ops if o['opcode']=='Filter']
   # Outer and IN exclude later grouped construction, NOT their local filter.
   no_filter=name in ('frame','skip-range')
   assert len(filters)==(0 if no_filter else 2 if name in ('group-outer','skip-group') else 1)
   assert any('BLOOM FILTER' in p for p in eqp)==(not no_filter)
   if name=='skip-range':assert any('ANY(a)' in p and 'b>?' in p for p in eqp)
   if name=='outer':assert any(o['opcode']=='NullRow' for o in ops)
   if name=='in':assert any(o['opcode']=='OpenEphemeral' for o in ops)
   captures.append({'case':name,'sql':sql,'columns':columns,'runs':runs,'eqp':eqp,'program':ops})
  variants.append({'encoding':enc,'fixture':str(fixture),'sha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'cases':captures})
 finally:assert d.sqlite3_close(db)==0
pathlib.Path(sys.argv[2]).write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':variants},indent=2)+'\n')
print('captured outer/IN local-filter and frame-boundary witnesses; three encodings, two runs')
