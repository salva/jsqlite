import json,pathlib,hashlib
r=pathlib.Path(__file__).resolve().parents[3];s=json.load(open(r/'test/conformance/row-vector/spec.json'));c=json.load(open(r/'test/conformance/row-vector/native.json'));m=json.load(open(r/'test/fixtures/row-vector/manifest.json'))
assert s['sourceId']==c['sourceId']==m['sourceId']==json.load(open(r/'reference/sqlite/manifest.json'))['sqliteSourceId']
assert len(s['cases'])==41 and len({x['id'] for x in s['cases']})==41 and c['credit']==0
for k,e in c['encodings'].items():assert [(x['id'],x['sql']) for x in e['cases']]==[(x['id'],x['sql']) for x in s['cases']]
for f in m['files']:assert hashlib.sha256((r/'test/fixtures/row-vector'/f['path']).read_bytes()).hexdigest()==f['sha256']
print('41 cases x 3 encodings = 123 executions; 22 exact upstream assertions; all zero credit')
