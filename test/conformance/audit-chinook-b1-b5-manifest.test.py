#!/usr/bin/env python3
import hashlib,json,pathlib
r=pathlib.Path(__file__).resolve().parents[2];s=json.load(open(r/'test/conformance/cases/audit-chinook-b1-b5.spec.json'));c=json.load(open(r/'test/conformance/cases/audit-chinook-b1-b5.json'));m=json.load(open(r/'test/fixtures/chinook-b1-b5/manifest.json'));src=json.load(open(r/'reference/sqlite/manifest.json'));pub=json.load(open(r/s['chinook']['manifest']))
assert s['sourceId']==c['sourceId']==m['sourceId']==src['sqliteSourceId'];assert pub['sha256']==s['chinook']['sha256'];assert len(s['cases'])==22 and len(c['executions'])==56 and c['credit']==0
for f in m['files']:
 p=r/'test/fixtures/chinook-b1-b5'/f['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
assert [(x['id'],x['expected']) for x in s['nativeOnly']]==[('e_expr-13.1.2',{'calls':1,'value':1}),('e_expr-13.1.4',{'calls':1,'value':1})]
print(json.dumps({'sourceId':c['sourceId'],'cases':22,'executions':56,'nativeOnlyAssertions':2,'credit':0},separators=(',',':')))
