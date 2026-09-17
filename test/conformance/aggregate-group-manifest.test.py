#!/usr/bin/env python3
import hashlib,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];spec=json.load(open(root/'test/conformance/cases/stage3-aggregate-group.spec.json'));cap=json.load(open(root/'test/conformance/cases/stage3-aggregate-group.json'));manifest=json.load(open(root/'reference/sqlite/manifest.json'))
assert spec['source']['version']==cap['source']['version']==manifest['version'];assert spec['source']['sourceId']==cap['source']['sourceId']==manifest['sqliteSourceId']
assert spec['fixtureGeneration']==cap['fixtureGeneration']==json.load(open(root/'test/fixtures/CURRENT.json'))['generationId']
assert len(spec['cases'])==len(cap['cases'])==37;assert len({c['id'] for c in spec['cases']})==37
assert cap['accounting']=={'declared':37,'nativeCaptured':37,'tsAttempted':0,'tsCredited':0}
assert set(spec['requiredCoverage'])=={'empty','types','overflow','group','having','resolver','affinity-collation','bare-minmax','distinct-filter-order','composition','encoding','reset-metadata','errors-lifecycle'}
by={c['id']:c for c in cap['cases']}; expected_errors={c['id'] for c in spec['cases'] if c.get('expectedPrepareError')}
for c in spec['cases']:
 o=by[c['id']]; assert (o['fixture'],o['sql'])==(c['fixture'],c['sql']); assert len(o['fixtureSha256'])==64
 if c['id'] in expected_errors: assert o['native']['prepare']['kind']=='error',c['id']
 else: assert o['native']['prepare']['kind']=='ok',c['id']
assert by['sum-int64-overflow']['native']['first']['kind']=='error'
assert by['reset-rebind']['native']['resetCode']==0 and by['reset-rebind']['native']['afterResetRebind']['kind']=='done'
assert {by[x]['databaseEncoding'] for x in ('encoding-utf8','encoding-utf16le','encoding-utf16be')}=={'UTF-8','UTF-16le','UTF-16be'}
print('aggregate contract manifest: 37 unique pinned cases; 37 native; 0 TS credit')
