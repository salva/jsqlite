#!/usr/bin/env python3
"""Validate retained evidence, not runtime compatibility."""
import hashlib,json,pathlib
p=pathlib.Path(__file__).parent;j=json.loads((p/'native.json').read_text());variants=j['variants']; assert len(variants)==12
for v in variants:
 f=v['fixture'];raw=(p/'fixtures'/f['path']).read_bytes();assert len(raw)==f['bytes'] and hashlib.sha256(raw).hexdigest()==f['sha256']
 for c in v['cases']:
  if c['id']=='prepare-error':assert c['prepareRc']==1 and c['error']=='no such column: missing';continue
  assert c['prepareRc']==0 and c['finalizeRc']==0
  for r in c['runs']:assert r['stepRc']==101 and r['resetRc']==0 and r['clearRc']==0
 if v['control']=='stat1':
  for k,rc in [('progressInterrupt',9),('lengthLimit',18)]:assert v[k]['runs'][0]['stepRc']==rc and v[k]['runs'][0]['resetRc']==rc
  assert v['interruptRecovery']['runs'][0]['stepRc']==101 and v['limitRecovery']['runs'][0]['stepRc']==101
  bad=v['malformedSelectedRoot'];assert hashlib.sha256((p/'fixtures'/bad['fixture']).read_bytes()).hexdigest()==bad['sha256']
  assert [r['stepRc'] for r in bad['capture']['runs']]==[11,11]
  for name in ['upstream-one','upstream-two','prefix-null-desc-affinity','range-restart','in-restart','reverse','joined-reset','left-miss','or-overlap','wr-primary-cover','wr-secondary-noncover','wr-secondary-cover','empty-prefix']:
   c=next(c for c in v['cases'] if c['id']==name)
   def text(x):return bytes.fromhex(x['utf8Hex']).decode()
   assert any('ANY(' in text(row[3]) for row in c['plans'][0]['eqp']),name
   ops=[text(row[1]) for row in c['plans'][0]['program']]
   assert 'SeekGT' in ops or 'SeekLT' in ops,name
 else:
  assert not any('ANY(' in bytes.fromhex(row[3]['utf8Hex']).decode() for c in v['cases'] for plan in c['plans'] for row in plan['eqp'])
for control in ['stat1','noStats','noskipscan','lowDuplicates']:
 vs=[v for v in variants if v['control']==control]
 base=[(c['id'],c['columns'] if 'columns' in c else None,c['runs']) for c in vs[0]['cases']]
 for v in vs[1:]:
  for a,b in zip(vs[0]['cases'],v['cases']):
   assert a['id']==b['id'] and a.get('columns')==b.get('columns')
   assert [r['rows'] for r in a['runs']]==[r['rows'] for r in b['runs']]
print('PASS: 15 fixture hashes, 87 case captures, typed rows/ordered columns across encodings, skip/control EQP and restart opcodes, native errors/reset/recovery; TS credit 0')
