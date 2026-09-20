#!/usr/bin/env python3
import hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec_path=ROOT/'test/conformance/cases/stage3-date-time.spec.json'; spec=json.loads(spec_path.read_text())
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert spec['source']['sourceId']==manifest['sqliteSourceId']
assert spec['scope']['denominatorAssertions']==18 and spec['scope']['selectedCases']==29
assert len(spec['cases'])==29 and len(spec['adaptations'])==6
upstream=[c for c in spec['cases'] if 'upstreamAssertion' in c]
assert len(upstream)==18 and sum(c.get('credit')=='zero-credit-companion' for c in spec['cases'])==2
assert sum(c.get('credit')=='zero-credit-source-boundary' for c in spec['cases'])==9
assert spec['scope']['tsCredit']==0 and len({c['id'] for c in spec['cases']})==29
for c in spec['cases']:
 assert c['sql'].startswith('SELECT ') and c['encodings']==['UTF-8','UTF-16le','UTF-16be'] and 'expectedTyped' in c
 if 'upstreamAssertion' in c:
  u=c['upstreamAssertion']; p=ROOT/'reference/sqlite/sqlite-src-3530400'/u['path']; lines=p.read_text().splitlines(True)
  body=''.join(lines[u['startLine']-1:u['endLine']])
  assert body.rstrip('\n')==u['body'] and hashlib.sha256(body.encode()).hexdigest()==u['bodySha256']
for a in spec['adaptations']:
 assert a['credit'] is False and a['currentDisposition']=='expected-temporary-unsupported'
 assert a['sql'] and 'setup' in a and a['sequence'] and ('expected' in a or 'expectedCaseIds' in a)
native=json.loads((ROOT/'test/conformance/cases/stage3-date-time.native.json').read_text())
assert native['kind']=='native-reference-only-no-ts-credit' and native['source']['sourceId']==spec['source']['sourceId']
assert native['source']['specSha256']==hashlib.sha256(spec_path.read_bytes()).hexdigest()
assert native['counts']=={'denominatorAssertions':18,'selectedCases':29,'observations':87,'tsCredit':0}
expected={(c['id'],e):(c['sql'],c['expectedTyped']) for c in spec['cases'] for e in c['encodings']}
actual={(o['id'],o['encoding']):(o['sql'],o.get('row',[None])[0]) for o in native['observations']}
assert actual==expected
print('date/time manifest: 18 exact upstream assertions, 2 zero-credit result companions, 9 zero-credit boundaries, 6 concrete seam contracts, 87 oracle observations, TS credit 0/18')
