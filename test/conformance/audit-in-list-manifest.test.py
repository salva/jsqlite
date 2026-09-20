#!/usr/bin/env python3
import hashlib,json,pathlib
r=pathlib.Path(__file__).resolve().parents[2];s=json.load(open(r/'test/conformance/cases/audit-in-list.spec.json'));c=json.load(open(r/'test/conformance/cases/audit-in-list.json'));m=json.load(open(r/'test/fixtures/in-list/manifest.json'));src=json.load(open(r/'reference/sqlite/manifest.json'))
assert s['sourceId']==c['sourceId']==m['sourceId']==src['sqliteSourceId'];assert len(s['cases'])==21;assert set(c['encodings'])=={'utf8','utf16le','utf16be'}
for e in c['encodings'].values():assert len(e['cases'])==21;assert [x['id'] for x in e['cases']]==[x['id'] for x in s['cases']]
for f in m['files']:
 p=r/'test/fixtures/in-list'/f['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
assert c['credit']==0
print(json.dumps({'sourceId':c['sourceId'],'cases':21,'encodingExecutions':63,'credit':0},separators=(',',':')))
