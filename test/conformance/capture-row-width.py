#!/usr/bin/env python3
"""Pinned development-only row-width oracle. Never imported by runtime."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
MANIFEST=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
OUT=ROOT/'test/conformance/cases/row-width-native.json'
STATES={
 'before':None,'after':[],
 'small-a':[("t","ta","300 30 sz=2"),("t","tb","300 30 1 sz=200"),("t",None,"300 sz=400")],
 'small-b':[("t","ta","300 30 sz=200"),("t","tb","300 30 1 sz=2"),("t",None,"300 sz=400")],
 'clamp':[("t","ta","300 30 sz=0"),("t",None,"300 sz=1")],
 'overflow':[("t","ta","300 30 sz=2147483648"),("t",None,"300 sz=999999999999999999999")],
 'max-int':[("t","ta","300 30 sz=2147483647")],
 'unknown-index':[("t","missing","300 sz=2")],
 'unknown-table':[("missing","ta","300 30 sz=2")],
 'unknown-token':[("t","ta","300 30 x=5 sz=20suffix junk unorderedX noskipscanX")],
 'spaces':[("t","ta","300  30 sz=10")],
 'tab':[("t","ta","300\t30 sz=10")],
 'negative':[("t","ta","-3 30 sz=-1")],
 'uint64-overflow':[("t","ta","18446744073709551616 30 sz=20")],
 'null-stat':[("t","ta",None)],
 'integer-stat':[("t","ta",300)],
 'real-stat':[("t",None,300.5)],
 'blob-stat':[("t","ta",b'300 30 sz=2\0 sz=900')],
 'blob-names':[(b't',b'ta',b'300 30 sz=2')],
 'null-table':[(None,"ta","300 30 sz=2")],
 'cross':[("noipk","ta","64 4 sz=16")],
 'cross-partial':[("noipk","tp","64 4 sz=16")],
 'duplicate':[("noipk","tb","64 4 2 sz=16 unordered"),("noipk","tb","8")],
 'duplicate-reversed':[("noipk","tb","8"),("noipk","tb","64 4 2 sz=16 unordered")],
 'hex':[("t","ta","300 30 sz=0x10")],
 'hex-upper':[("t","ta","300 30 sz=0X00000010")],
 'hex-max':[("t","ta","300 30 sz=0x7fffffff")],
 'hex-overflow':[("t","ta","300 30 sz=0x80000000")],
 'hex-long':[("t","ta","300 30 sz=0x100000000")],
 'hex-signed':[("t","ta","300 30 sz=+0x10")],
 'hex-negative':[("t","ta","300 30 sz=-0x10")],
 'hex-zero':[("t","ta","300 30 sz=00016")],
 'table-only-low':[("t",None,"8 sz=16")],
 'table-only-high':[("t",None,"65536 sz=1048576")],
 'tie-small-a':[("t","ta","1024 10 sz=16"),("t","tb","1024 10 1 sz=20"),("t",None,"1024 sz=1048576")],
 'tie-small-b':[("t","ta","1024 10 sz=20"),("t","tb","1024 10 1 sz=16"),("t",None,"1024 sz=1048576")],
 'tie-equal':[("t","ta","1024 10 sz=16"),("t","tb","1024 10 1 sz=16"),("t",None,"1024 sz=1048576")],
 'scan-equal':[("t","ta","1024 10 sz=16"),("t",None,"1024 sz=16")],
 'scan-larger':[("t","ta","1024 10 sz=20"),("t",None,"1024 sz=16")],
 'wr-table-name':[("wr","wr","30 3 1 sz=2")],
}
SQL={
 'cover':'SELECT a FROM t WHERE a=?1 ORDER BY a LIMIT 4',
 'noncover':'SELECT id,a,c,tag FROM t WHERE a=?1 ORDER BY id LIMIT 4',
 'real-cover':'SELECT id,c FROM t INDEXED BY tc WHERE c>=?1 ORDER BY c,id LIMIT 4',
 'scan':'SELECT id,a,c,tag FROM t NOT INDEXED WHERE a=?1 ORDER BY id LIMIT 4',
 'join':'SELECT x.id,y.c FROM t AS x CROSS JOIN t AS y WHERE x.id=?1 AND y.a=x.a ORDER BY y.id LIMIT 4',
 'wr':'SELECT a,b,c FROM wr WHERE a=?1 COLLATE NOCASE ORDER BY b DESC',
 'expression':'SELECT id FROM t INDEXED BY te WHERE lower(tag)=?1 ORDER BY id LIMIT 4',
 'tie':'SELECT a FROM t WHERE a=?1 ORDER BY id LIMIT 4',
 'full':'SELECT a FROM t LIMIT 4',
 'rowid':'SELECT a FROM t WHERE id=?1 LIMIT 4',
 'aux-order':'SELECT a FROM t WHERE a=1 ORDER BY a',
 'aux-no-order':'SELECT a FROM t WHERE a=1',
 'path-bias':'SELECT x.id,y.a FROM t x CROSS JOIN t y INDEXED BY ta WHERE x.id=?1 AND y.a=x.a LIMIT 4',
 'invalid':'SELECT absent FROM t',
}
RUNS={'aux-order':[None],'aux-no-order':[None],'path-bias':[1,2,None],'tie':[1,2,None],'full':[None,None,None],'rowid':[1,2,None],'cover':[1,2,None],'noncover':[1,2,None],'scan':[1,2,None],'real-cover':[1.0,2.5,None],'join':[1,2,None],'wr':['é','A',None],'expression':['é','a',None],'invalid':[None]}
def open_db(d,f,ro):
 db=C.c_void_p();rc=d.sqlite3_open_v2(str(f).encode(),C.byref(db),1 if ro else 6,None)
 assert rc==m.OK,(f,rc)
 return db
def literal(v):
 if v is None:return 'NULL'
 if isinstance(v,bytes):return "X'"+v.hex()+"'"
 if isinstance(v,str):return "'"+v.replace("'","''")+"'"
 return str(v)
def build(d,root):
 root.mkdir(parents=True,exist_ok=True)
 for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
  for state,stats in STATES.items():
   f=root/f'row-width-{enc}-{state}.db';f.unlink(missing_ok=True);db=open_db(d,f,False)
   try:
    for q in [f"PRAGMA encoding='{pragma}'",'CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,c REAL,tag VARCHAR(100),wide BLOB(1000),u TEXT UNIQUE)', 'CREATE INDEX ta ON t(a)','CREATE INDEX tb ON t(a,tag)','CREATE INDEX tc ON t(c)','CREATE INDEX te ON t(lower(tag))', 'CREATE TABLE noipk(a,b TEXT,c CHAR(40),d DOUBLE, e BLOB)', 'CREATE TABLE wr(a TEXT COLLATE NOCASE,b INTEGER,c REAL,PRIMARY KEY(a,b DESC)) WITHOUT ROWID', 'CREATE INDEX wx ON wr(b,a COLLATE BINARY)', 'CREATE INDEX wy ON wr(a COLLATE NOCASE,b DESC)', "INSERT INTO wr VALUES('é',2,2.5),('A',3,3.0),('a',1,NULL)"]:
     m.execsql(d,db,q)
    m.execsql(d,db,'BEGIN')
    for i in range(1,301):m.execsql(d,db,f"INSERT INTO t VALUES({i},{'NULL' if i==300 else i%10},{'NULL' if i==299 else i/10},'{ 'é' if i%2 else 'A'}',X'0102','u{i}')")
    m.execsql(d,db,'COMMIT')
    if state=='cross-partial':m.execsql(d,db,'CREATE INDEX tp ON t(a) WHERE a IS NOT NULL')
    if state.startswith('tie-') or state.startswith('scan-'):
     for ix in ['tb' if state.startswith('scan-') else 'te','tc'] :m.execsql(d,db,'DROP INDEX '+ix)
    if state!='before':m.execsql(d,db,'ANALYZE')
    if stats:
     m.execsql(d,db,'DELETE FROM sqlite_stat1')
     for row in stats:m.execsql(d,db,'INSERT INTO sqlite_stat1 VALUES('+','.join(map(literal,row))+')')
   finally:d.sqlite3_close(db)
def query_runs(d,db,sql,values):
 st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
 if rc!=0:return {'error':{'phase':'prepare','code':rc,'message':d.sqlite3_errmsg(db).decode()}}
 try:
  names=[d.sqlite3_column_name(st,i).decode() for i in range(d.sqlite3_column_count(st))]
  runs=[]
  for v in values:
   d.sqlite3_reset(st);d.sqlite3_clear_bindings(st)
   if '?1' in sql:m.bind(d,st,[v])
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc==m.ROW:rows.append([m.cell(d,st,i) for i in range(len(names))]);continue
    if rc!=m.DONE:raise RuntimeError((sql,rc))
    break
   retained=[];d.sqlite3_reset(st)
   while True:
    rc=d.sqlite3_step(st)
    if rc==m.ROW:retained.append([m.cell(d,st,i) for i in range(len(names))]);continue
    assert rc==m.DONE;break
   assert retained==rows
   runs.append({'resetRetainedRows':retained,'binding':literal(v),'rows':rows,'eqp':m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,[v] if '?1' in sql else []),'access':m.explain(d,db,'EXPLAIN ',sql,[v] if '?1' in sql else [])})
  return {'columns':names,'runs':runs}
 finally:d.sqlite3_finalize(st)
def capture(d,root):
 assert d.sqlite3_sourceid().decode()==MANIFEST['sqliteSourceId']
 variants=[]
 for enc in ('utf8','utf16le','utf16be'):
  for state in STATES:
   f=root/f'row-width-{enc}-{state}.db';db=open_db(d,f,True)
   try:
    xinfo={n:m.query(d,db,f"PRAGMA index_xinfo('{n}')")[0] for n in ['ta','tb','tc','te','sqlite_autoindex_t_1','sqlite_autoindex_wr_1','wx','wy']}
    cases={n:query_runs(d,db,q,RUNS[n]) for n,q in SQL.items()}
    variants.append({'encoding':enc,'state':state,'fixture':str(f.relative_to(ROOT)), 'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'schema':m.query(d,db,'SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema ORDER BY rowid')[0], 'stat1':m.query(d,db,'SELECT tbl,idx,stat FROM sqlite_stat1 ORDER BY rowid')[0] if state!='before' else [],'xinfo':xinfo,'cases':cases})
   finally:d.sqlite3_close(db)
 return {'schema':'row-width-native/1','sourceId':MANIFEST['sqliteSourceId'],'archiveSha256':MANIFEST['sha256'],'sql':SQL,'bindings':RUNS,'variants':variants}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--regenerate',action='store_true');a=p.parse_args();d=m.load(a.library)
 d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
 d.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];d.sqlite3_column_name.restype=C.c_char_p
 root=ROOT/'test/conformance/fixtures'
 if a.regenerate:build(d,root)
 result=capture(d,root)
 if a.regenerate:OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 else:assert result==json.loads(OUT.read_text()),'pinned recapture differs'
 print('pinned snapshots',len(result['variants']),'fixture bytes',sum(v['bytes'] for v in result['variants']))
