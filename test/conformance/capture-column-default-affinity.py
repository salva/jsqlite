#!/usr/bin/env python3
"""Pinned mixed-affinity CAST controls; synthetic id-only short row, not ALTER.
Refuses overwrite. Native creates filled/NULL rows and reads exact shortened image.
"""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('oracle',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
receipt=ROOT/'test/conformance/cases/column-default-affinity-native.json';assert not receipt.exists()
types=['BLOB REAL','REAL BLOB','REAL BLOB INT','INT BLOB REAL','BLOB REAL TEXT','TEXT REAL BLOB','CLOB REAL','CHAR BLOB','FLOA','DOUB','MYSTERY']
exprs=[f"CAST('12' AS {t})" for t in types]+["'0012'"]
names=[f'c{i}' for i in range(len(exprs))]
out={'source':manifest,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
def varint(data,p):
 v=0
 for i in range(9):
  b=data[p];p+=1;v=(v<<(8 if i==8 else 7))|(b if i==8 else b&127)
  if b<128 or i==8:return v,p
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 fixture=ROOT/f'test/conformance/fixtures/column-default-affinity-{enc.lower()}.db';assert not fixture.exists()
 setup=[f"PRAGMA encoding='{enc}'",'PRAGMA page_size=4096','CREATE TABLE t(id INTEGER PRIMARY KEY,'+','.join(f'{n} DEFAULT ({e})' for n,e in zip(names,exprs))+')','INSERT INTO t(id) VALUES(1)',f"INSERT INTO t VALUES(2,{','.join(['NULL']*len(names))})",'INSERT INTO t(id) VALUES(3)']
 db=C.c_void_p();assert d.sqlite3_open(str(fixture).encode(),C.byref(db))==m.OK
 try:
  for sql in setup:m.execsql(d,db,sql)
 finally:assert d.sqlite3_close(db)==m.OK
 data=bytearray(fixture.read_bytes());assert data[4096]==13
 cell=4096+int.from_bytes(data[4104:4106],'big');_,p=varint(data,cell);rowid,p=varint(data,p);assert rowid==1
 data[cell:cell+4]=bytes([2,1,2,0]);fixture.write_bytes(data)
 queries=['SELECT '+','.join(exprs),'SELECT id,'+','.join(names)+' FROM t NOT INDEXED ORDER BY id','SELECT id,'+','.join(f'typeof({n})' for n in names)+' FROM t NOT INDEXED ORDER BY id','SELECT x.id,'+','.join(f'y.{n}' for n in names)+' FROM t x LEFT JOIN t y ON y.id=x.id+1 ORDER BY x.id']
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==m.OK
 cases=[]
 try:
  for sql in queries:
   st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==m.OK,sql
   try:
    runs=[]
    for run in range(2):
     rows=[]
     while True:
      rc=d.sqlite3_step(st)
      if rc==m.ROW:rows.append([m.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
      else:assert rc==m.DONE;break
     runs.append(rows);assert d.sqlite3_reset(st)==m.OK
    assert runs[0]==runs[1]
    metadata=[]
    for i in range(d.sqlite3_column_count(st)):
     item={}
     for key,name in [('name','name'),('declaredType','decltype'),('databaseName','database_name'),('tableName','table_name'),('originName','origin_name')]:
      v=getattr(d,'sqlite3_column_'+name)(st,i);item[key]=v.decode() if v is not None else None
     metadata.append(item)
    cases.append({'sql':sql,'native':{'rows':runs[0],'metadata':metadata}})
   finally:assert d.sqlite3_finalize(st)==m.OK
 finally:assert d.sqlite3_close(db)==m.OK
 out['variants'].append({'encoding':enc,'fixture':str(fixture.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'shortRecordSerials':[0],'setup':setup,'cases':cases})
receipt.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':out['librarySha256'],'fixtures':[{k:v[k] for k in ['encoding','sha256']} for v in out['variants']]}))
