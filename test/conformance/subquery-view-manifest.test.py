#!/usr/bin/env python3
"""Validate the frozen native-only subquery/view architecture gate."""
import json, pathlib, re, hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.spec.json'))
out=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.json'))
manifest=json.load(open(ROOT/'reference/sqlite/manifest.json'))
assert spec['source']['version']==manifest['version']=='3.53.4'
assert spec['source']['sourceId']==manifest['sqliteSourceId']
assert out['source']==spec['source'] and out['disposition']==spec['disposition']
assert len(spec['cases'])==len(out['cases'])==39
assert len({c['id'] for c in spec['cases']})==39
assert out['accounting']=={'declared':39,'nativeCaptured':39,'tsAttempted':0,'tsCredited':0}
assert 'zero credit' in spec['disposition']
current=json.load(open(ROOT/'test/fixtures/CURRENT.json'))
assert out['fixtureGeneration']==current['generationId']
cat=json.load(open(ROOT/'test/fixtures/generations'/out['fixtureGeneration']/'catalog.json'))
fixtures={f['id']:f for f in cat['semantic']['fixtures']}
by_id={c['id']:c for c in out['cases']}
for c in spec['cases']:
 o=by_id[c['id']]; f=fixtures[c['fixture']]
 assert o['fixtureSha256']==f['sha256']
 path=ROOT/'test/fixtures/generations'/out['fixtureGeneration']/f['path']
 assert hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256']
 prepare=o['native']['prepare']['kind']
 assert prepare==('error' if c.get('expectedPrepareError') else 'ok'), c['id']
 if prepare=='ok':
  first=o['native']['first']
  if c['id']=='aggregate30-sum-int64-overflow':
   assert first['kind']=='error' and first['error']['phase']=='step'
  else: assert first['kind']=='done', c['id']
 # Provenance is canonical file-prefix + exact Tcl assertion label. Project
 # aggregate references instead identify an existing frozen project case.
 for u in c['upstream']:
  if u.startswith('stage3-aggregate-group:'):
   aid=u.split(':',1)[1]
   agg=json.load(open(ROOT/'test/conformance/cases/stage3-aggregate-group.json'))
   assert any(x['id']==aid for x in agg['cases'])
   continue
  prefix,label=u.split('-',1); t=(ROOT/f'reference/sqlite/sqlite-src-3530400/test/{prefix}.test').read_text(errors='replace')
  assert re.search(r'(?m)^\s*do_(?:execsql_|catchsql_)?test\s+(?:'+re.escape(prefix)+r'-)?'+re.escape(label)+r'\s*\{',t), u
assert {c['id'] for c in spec['cases'] if c.get('atomicGate')}=={'gate-cte-nonrecursive','gate-cte-recursive','gate-window'}
assert {c['atomicGate'] for c in spec['cases'] if c.get('atomicGate')}=={'cte','recursive-cte','window'}
assert {c['id'] for c in spec['cases'] if c['id'].startswith('aggregate30-')}=={
 'aggregate30-sum-real-promotion','aggregate30-sum-int64-overflow',
 'aggregate30-total-no-overflow','aggregate30-group-concat-null-separator'}
print('subquery/view manifest: 39 native captures, 0 TypeScript credit; provenance and gates valid')
