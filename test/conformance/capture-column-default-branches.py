#!/usr/bin/env python3
"""Pinned valueFromExpr branch controls with explicitly synthesized short row.

Native creates schema/filled/NULL rows; deterministic four-byte leaf-cell edit
makes row1 id-only. Native reopens that exact image read-only for expectations.
This is not ALTER-produced provenance; the original ALTER fixtures are untouched.
"""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('planner',ROOT/'test/conformance/capture-index-planner.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[1]);manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 fn=getattr(d,'sqlite3_column_'+name);fn.argtypes=[C.c_void_p,C.c_int];fn.restype=C.c_char_p
out={'source':manifest,'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'variants':[]}
def varint(data,pos):
 value=0
 for i in range(9):
  byte=data[pos];pos+=1;value=(value<<(8 if i==8 else 7))|(byte if i==8 else byte&127)
  if byte<128 or i==8:return value,pos
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 fixture=ROOT/f'test/conformance/fixtures/column-default-branches-{enc.lower()}.db';assert not fixture.exists()
 definitions=[f'c{i} TEXT DEFAULT ({token})' for i,token in enumerate(['-(+1.2500)','-(-1.2500)','CAST(1.2500 AS TEXT)','CAST(1e0 AS NUMERIC)','0012','-9223372036854775808','0xffffffffffffffff','-0x1',"'héllo'",'NULL',"x'0012'",'1+2'])]
 names=[f'c{i}' for i in range(len(definitions))]
 setup=[f"PRAGMA encoding='{enc}'",'PRAGMA page_size=4096','CREATE TABLE t(id INTEGER PRIMARY KEY,'+','.join(definitions)+')','INSERT INTO t(id) VALUES(1)']
 # CREATE TABLE admits CAST/nested unary defaults that ALTER on a nonempty
 # table rejects. Row1 is shortened explicitly below; row3 stays filled.
 setup += [f"INSERT INTO t VALUES(2,{','.join(['NULL']*len(names))})",'INSERT INTO t(id) VALUES(3)']
 db=C.c_void_p();assert d.sqlite3_open(str(fixture).encode(),C.byref(db))==m.OK
 try:
  for sql in setup:m.execsql(d,db,sql)
 finally:assert d.sqlite3_close(db)==m.OK
 data=fixture.read_bytes();assert data[4096]==13
 cell=4096+int.from_bytes(data[4104:4106],'big');_,pos=varint(data,cell);rowid,pos=varint(data,pos)
 size,at=varint(data,pos);serials=[]
 while at<pos+size:
  serial,at=varint(data,at);serials.append(serial)
 # Replace only row1's payload with the legal id-only short record. Keep
 # cell/page allocation and all schema bytes intact; native reopens read-only.
 assert rowid==1 and len(serials)==len(names)+1,(rowid,serials)
 patched=bytearray(data);patched[cell:cell+4]=bytes([2,1,2,0]);fixture.write_bytes(patched)
 data=bytes(patched);serials=[0]
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==m.OK
 queries=['SELECT id,'+','.join(names)+' FROM t NOT INDEXED ORDER BY id','SELECT id,'+','.join(f'typeof({name})' for name in names)+' FROM t NOT INDEXED ORDER BY id','SELECT x.id,y.c0,y.c1,y.c2,y.c3 FROM t x LEFT JOIN t y ON y.id=x.id+1 ORDER BY x.id'];cases=[]
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
    if sql==queries[0]:
     assert runs[0][0][1]['type']=='text'
     assert all(c['type']=='null' for c in runs[0][1][1:])
    metadata=[]
    for i in range(d.sqlite3_column_count(st)):
     item={}
     for key,name in [('name','name'),('declaredType','decltype'),('databaseName','database_name'),('tableName','table_name'),('originName','origin_name')]:
      value=getattr(d,'sqlite3_column_'+name)(st,i);item[key]=value.decode() if value is not None else None
     metadata.append(item)
    cases.append({'sql':sql,'native':{'rows':runs[0],'metadata':metadata}})
   finally:assert d.sqlite3_finalize(st)==m.OK
 finally:assert d.sqlite3_close(db)==m.OK
 out['variants'].append({'encoding':enc,'fixture':str(fixture.relative_to(ROOT)),'sha256':hashlib.sha256(data).hexdigest(),'shortRecordSerials':serials,'setup':setup,'cases':cases})
receipt=ROOT/'test/conformance/cases/column-default-branches-native.json';assert not receipt.exists()
receipt.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':out['librarySha256'],'variants':[{k:v[k] for k in ['encoding','sha256','shortRecordSerials']} for v in out['variants']]}))
