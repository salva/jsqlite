#!/usr/bin/env python3
"""Verify identical shared LIMIT cases against the source-ID pinned library."""
import ctypes as C, importlib.util, json, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-relational-working-state.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
d=m.load(sys.argv[1]);expected=json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
assert d.sqlite3_sourceid().decode()==expected;print('verified sourceID',expected)
d.sqlite3_bind_int64.argtypes=[C.c_void_p,C.c_int,C.c_int64];d.sqlite3_bind_text.argtypes=[C.c_void_p,C.c_int,C.c_char_p,C.c_int,C.c_void_p]
cases=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {limitCases} from './test/conformance/limit-offset-adjudication-cases.mjs';console.log(JSON.stringify(limitCases))"],cwd=root))
current=json.loads((root/'test/fixtures/CURRENT.json').read_text())
for fixture in ['storage-p4096','storage-p4096-utf16le','storage-p4096-utf16be']:
 h=C.c_void_p();assert d.sqlite3_open(str(root/'test/fixtures/generations'/current['generationId']/'generated'/f'{fixture}.db').encode(),C.byref(h))==0
 for c in cases:
  st=C.c_void_p();tail=C.c_char_p();assert d.sqlite3_prepare_v2(h,c['sql'].encode(),-1,C.byref(st),C.byref(tail))==0
  for i,v in enumerate(c.get('bindings',[]),1):
   assert (d.sqlite3_bind_int64(st,i,v) if isinstance(v,int) else d.sqlite3_bind_text(st,i,v.encode(),-1,C.c_void_p(-1)))==0
  traces=[]
  for attempt in range(2):
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    row=[]
    for i in range(d.sqlite3_column_count(st)):
     t=d.sqlite3_column_type(st,i);row.append(None if t==5 else d.sqlite3_column_int64(st,i))
    rows.append(row)
   assert rc==c.get('error',101),(c,rc);assert rows==c.get('rows',[]),(c,rows)
   reset=d.sqlite3_reset(st) if attempt==0 else None
   if reset is not None:assert reset==c.get('error',0)
   traces.append({'step':rc,'rows':rows,'reset':reset})
  final=d.sqlite3_finalize(st);assert final==c.get('error',0)
  print(json.dumps({'fixture':fixture,'sql':c['sql'],'bindings':c.get('bindings'),'prepare':0,'executions':traces,'finalize':final}))
 assert d.sqlite3_close(h)==0
print('48 cases / 96 executions matched including error reset/finalize phases')
