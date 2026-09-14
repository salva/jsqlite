#!/usr/bin/env python3
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];s=json.load(open(root/'test/conformance/cases/audit-expression-callers.spec.json'));m=json.load(open(root/'test/conformance/cases/audit-expression-callers.json'));src=json.load(open(root/'reference/sqlite/manifest.json'))
assert s['sourceId']==m['sourceId']==src['sqliteSourceId'];assert m['credit']=='audit-no-credit'
assert len(s['cases'])==len(m['cases'])==14
assert [x['id'] for x in s['cases']]==[x['id'] for x in m['cases']]
assert all(c['native'].get('rows') is not None or c['native'].get('error') for c in m['cases'])
assert all(c['ts']=={'disposition':'unimplemented-or-mismatch','credit':False} for c in m['cases'])
print(json.dumps({'sourceId':m['sourceId'],'declared':14,'nativeCaptured':14,'credit':0},separators=(',',':')))
