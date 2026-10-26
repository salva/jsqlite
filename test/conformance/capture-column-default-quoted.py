#!/usr/bin/env python3
"""Distinct native-FIRST quoted DEFAULT regression; preserves earlier fixtures."""
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
 fixture=ROOT/f'test/conformance/fixtures/column-default-quoted-{enc.lower()}.db';assert not fixture.exists()
 definitions=[];expected=[]
 for affinity in ['', 'TEXT']:
  for word in ['TRUE','FALSE']:
   for token in [f'"{word}"',f'[{word}]',f'`{word}`',word]:
    definitions.append(f'c{len(definitions)} {affinity} DEFAULT {token}')
    expected.append(word if token!=word else (str(int(word=='TRUE')) if affinity else int(word=='TRUE')))
 names=[f'c{i}' for i in range(len(definitions))]
 setup=[f"PRAGMA encoding='{enc}'",'PRAGMA page_size=4096','CREATE TABLE t(id INTEGER PRIMARY KEY)','INSERT INTO t VALUES(1)']
 setup += [f'ALTER TABLE t ADD COLUMN {definition}' for definition in definitions]
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
 assert rowid==1 and serials==[0],(rowid,serials)
 assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None)==m.OK
 queries=['SELECT id,'+','.join(names)+' FROM t NOT INDEXED ORDER BY id','SELECT id,'+','.join(f'typeof({name})' for name in names)+' FROM t NOT INDEXED ORDER BY id'];cases=[]
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
    assert runs[0][0][1:]==runs[0][2][1:]
    if sql==queries[0]:
     for cell,value in zip(runs[0][0][1:],expected):
      assert cell==({'type':'integer','value':str(value)} if isinstance(value,int) else {'type':'text','utf8Hex':value.encode().hex()}),(cell,value)
     assert all(cell['type']=='null' for cell in runs[0][1][1:])
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
receipt=ROOT/'test/conformance/cases/column-default-quoted-native.json';assert not receipt.exists()
receipt.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':out['librarySha256'],'variants':[{k:v[k] for k in ['encoding','sha256','shortRecordSerials']} for v in out['variants']]}))
