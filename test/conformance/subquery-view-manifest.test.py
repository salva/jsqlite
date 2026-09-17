#!/usr/bin/env python3
"""Validate the frozen native-only subquery/view architecture gate."""
import json,pathlib,re,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]; sha=lambda b:hashlib.sha256(b).hexdigest()
spec=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.spec.json')); out=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.json')); comp=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view-companions.spec.json')); manifest=json.load(open(ROOT/'reference/sqlite/manifest.json'))
assert spec['source']['version']==manifest['version']=='3.53.4' and spec['source']['sourceId']==manifest['sqliteSourceId']
assert out['source']==spec['source'] and out['disposition']==spec['disposition']; n=len(spec['cases']); assert n==len(out['cases'])==46 and len({c['id'] for c in spec['cases']})==n
assert out['accounting']=={'declared':n,'nativeCaptured':n,'tsAttempted':0,'tsCredited':0} and 'zero credit' in spec['disposition']
current=json.load(open(ROOT/'test/fixtures/CURRENT.json')); assert out['fixtureGeneration']==current['generationId']; cat=json.load(open(ROOT/'test/fixtures/generations'/out['fixtureGeneration']/'catalog.json')); fixtures={f['id']:f for f in cat['semantic']['fixtures']}; by_id={c['id']:c for c in out['cases']}
for c in spec['cases']:
 o=by_id[c['id']]; f=fixtures[c['fixture']]; path=ROOT/'test/fixtures/generations'/out['fixtureGeneration']/f['path']; assert o['fixtureSha256']==f['sha256']==sha(path.read_bytes())
 prepare=o['native']['prepare']['kind']; assert prepare==('error' if c.get('expectedPrepareError') else 'ok'),c['id']
 if prepare=='ok':
  first=o['native']['first']
  if c['id']=='aggregate30-sum-int64-overflow': assert first['kind']=='error' and first['error']['phase']=='step'
  else: assert first['kind']=='done',c['id']
 p=c['provenance']; assert p['classification'] in {'exact-translation','adapted-discriminator'} and p['rationale']; src=ROOT/p['implementingSource']['path']; raw=src.read_bytes(); assert sha(raw)==p['implementingSource']['sha256']; text=raw.decode(errors='replace'); assert all(m in text for m in p['implementingSource']['markers'])
 for e in p['evidence']:
  ep=ROOT/e['path']
  if e['kind']=='project-case':
   data=json.load(open(ep)); item=next(v for v in data['cases'] if v['id']==e['caseId']); assert sha(json.dumps(item,sort_keys=True,separators=(',',':')).encode())==e['sha256']
  else:
   s=ep.read_text(errors='replace'); prefix=ep.stem; label=e['assertion']; pat=re.compile(r'(?m)^\s*do_(?:execsql_|catchsql_)?test\s+(?:'+re.escape(prefix)+r'-)?'+re.escape(label)+r'\s*\{'); m=pat.search(s); assert m
   nxt=re.search(r'(?m)^\s*do_(?:execsql_|catchsql_)?test\s+',s[m.end():]); end=m.end()+nxt.start() if nxt else len(s); assert sha(s[m.start():end].rstrip().encode())==e['sha256'] and e['startLine']==s.count('\n',0,m.start())+1
assert {c['atomicGate'] for c in spec['cases'] if c.get('atomicGate')}=={'cte','recursive-cte','window'}
assert len([c for c in spec['cases'] if c['id'].startswith('aggregate30-')])==4
assert comp['accounting']=={'declared':15,'tsAttempted':0,'tsCredited':0} and len(comp['cases'])==15 and len({c['id'] for c in comp['cases']})==15 and 'zero credit' in comp['disposition']
required={'nesting-prepare-atomic','coroutine-suspend-resume','coroutine-cancel-inner','coroutine-deadline-inner','coroutine-work-inner','materialized-private-growth','in-set-private-growth','overlap-private-budget','reset-before-first-step','reset-after-suspension','rebind-correlated','finalize-suspended','first-error-cleanup','deferred-close-suspended','error-restores-admission'}; assert {c['id'] for c in comp['cases']}==required
print(f'subquery/view manifest: {n} native captures, 15 executable future companions, 0 TypeScript credit; hashed provenance valid')
