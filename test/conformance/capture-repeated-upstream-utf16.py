#!/usr/bin/env python3
"""Add UTF16 adapted join8 captures without replacing frozen UTF8 evidence."""
import ctypes as C, hashlib, importlib.util, json, os, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
guard_spec=importlib.util.spec_from_file_location('repeated_inputs',root/'test/conformance/repeated-capture-inputs.py')
guard=importlib.util.module_from_spec(guard_spec);guard_spec.loader.exec_module(guard)
guard.preflight(root,['cases/repeated-upstream-join8-utf16.json', 'fixtures/repeated-upstream-join8-utf16le.db', 'fixtures/repeated-upstream-join8-utf16be.db'])
s=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
m=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==m['sqliteSourceId']
assert d.sqlite3_libversion().decode()==m['version']
base=json.loads((root/'test/conformance/cases/repeated-upstream-join8.json').read_text())
assert base['sourceId']==m['sqliteSourceId']
out={'sourceId':base['sourceId'],'upstreamHash':base['upstreamHash'],'adaptations':base['adaptations'],'fixtures':{},'cases':[]}
for enc,encoding in [('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 setup=[f"PRAGMA encoding='{encoding}';"]+base['setup']
 path=root/f'test/conformance/fixtures/repeated-upstream-join8-{enc}.db'
 assert not path.exists(),f'refuse overwrite {path}'
 db=h.P();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 try:
  for sql in setup:assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0
 finally:assert d.sqlite3_close(db)==0
 out['fixtures'][enc]={'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 for c in base['cases']:
  native=h.capture(d,{'setups':{'s':setup}},{'id':c['id'],'sql':c['sql'],'setup':'s'})
  assert native['columns']==c['native']['columns']
  assert native['first']['rows']==c['native']['first']['rows']
  out['cases'].append({'encoding':enc,'id':c['id'],'sql':c['sql'],'native':native,'classification':c['classification']})
p=root/'test/conformance/cases/repeated-upstream-join8-utf16.json';assert not p.exists()
p.write_text(json.dumps(out,indent=2)+'\n');print('source-ID/version checked adapted upstream UTF16 captures:8/8')
