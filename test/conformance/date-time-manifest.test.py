#!/usr/bin/env python3
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=json.loads((ROOT/'test/conformance/cases/stage3-date-time.spec.json').read_text())
assert spec['source']['sourceId']==json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
assert spec['scope']['denominatorAssertions']==18 and spec['scope']['selectedCases']==20
assert len(spec['cases'])==20 and len(spec['adaptations'])==6
assert sum(c.get('credit')!='zero-credit-companion' for c in spec['cases'])==18
assert spec['scope']['tsCredit']==0
assert len({c['id'] for c in spec['cases']})==20
for c in spec['cases']:
 assert c['sql'].startswith('SELECT ') and c['encodings']==['UTF-8','UTF-16le','UTF-16be']
 assert c['source'].startswith(('test/date.test:','test/timediff1.test:','src/date.c:'))
for c in spec['adaptations']: assert c['credit'] is False
native=ROOT/'test/conformance/cases/stage3-date-time.native.json'
if native.exists():
 n=json.loads(native.read_text()); assert n['kind']=='native-reference-only-no-ts-credit'
 assert n['source']['sourceId']==spec['source']['sourceId'] and n['counts']=={'denominatorAssertions':18,'selectedCases':20,'observations':60,'tsCredit':0}
 assert len(n['observations'])==60
print('date/time manifest: 18 upstream assertions, 2 zero-credit source companions, 6 zero-credit adaptations, TS credit 0/18')
