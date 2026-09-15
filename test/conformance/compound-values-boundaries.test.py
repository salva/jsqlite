#!/usr/bin/env python3
import hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-compound-values-boundaries.spec.json'; CAP=ROOT/'test/conformance/cases/stage3-compound-values-boundaries.json'; MAN=ROOT/'reference/sqlite/manifest.json'
class CompoundBoundaries(unittest.TestCase):
 def setUp(self):self.s=json.loads(SPEC.read_text());self.d=json.loads(CAP.read_text())
 def test_identity_projection_and_zero_credit(self):
  m=json.loads(MAN.read_text());self.assertEqual((m['version'],m['sqliteSourceId']),(self.s['source']['version'],self.s['source']['sourceId']))
  a=ROOT/'reference/sqlite'/m['archive'];self.assertEqual(hashlib.sha256(a.read_bytes()).hexdigest(),m['sha256'])
  self.assertEqual(self.d['schema'],'jsqlite-compound-values-boundaries/1');self.assertEqual(self.d['source'],self.s['source']);self.assertEqual(self.d['requiredCoverage'],self.s['requiredCoverage'])
  self.assertEqual([c['id'] for c in self.d['cases']],[c['id'] for c in self.s['cases']]);self.assertEqual(self.d['accounting'],{'declaredCases':12,'nativeMatched':12,'tsPrepareAttempts':11,'tsCreditedCases':0,'nativeExpectationsSeparateFromTsCredit':True,'countDerivedSuccessForbidden':True,'classification':'no-credit-boundary-companions'})
  self.assertLessEqual(set(self.d['requiredCoverage']),{x for c in self.d['cases'] for x in c['coverage']})
  for e,a in zip(self.s['cases'],self.d['cases'],strict=True):
   self.assertEqual({k:a[k] for k in e if k!='capture'},{k:v for k,v in e.items() if k!='capture'});self.assertFalse(a['ts']['credit'])
 def test_exact_semantic_boundaries(self):
  c={x['id']:x for x in self.d['cases']}; rows=lambda i:c[i]['native']['terminal'].get('rows',[])
  self.assertEqual(len(rows('collation-right-fallback')),1)
  self.assertEqual([[x['utf8Hex'] for x in r] for r in rows('collation-left-wins-per-column')],[['41','58'],['61','78']])
  self.assertEqual(rows('representative-right-integer')[0][0],{'type':'integer','value':'1'})
  self.assertEqual(rows('intersect-duplicate-runs'),[[{'type':'integer','value':'1'}]])
  self.assertEqual(rows('except-duplicate-runs'),[[{'type':'integer','value':'2'}]])
  self.assertEqual([r[0]['value'] for r in rows('order-later-arm-alias')],['1','2']);self.assertEqual([r[0]['utf8Hex'] for r in rows('order-explicit-collate-desc')],['42','61'])
  e=c['order-ordinal-range-error']['native']['terminal']['firstError'];self.assertEqual((e['operation'],e['message']),('prepare','1st ORDER BY term out of range - should be between 1 and 1'))
  self.assertEqual(rows('union-all-limit-zero-skips-error'),[]);self.assertEqual(rows('union-all-limit-one-skips-later-error'),[[{'type':'integer','value':'1'}]])
  e=c['union-limit-does-not-prune-set-membership']['native']['terminal']['firstError'];self.assertEqual((e['operation'],e['message']),('stepAll','integer overflow'))
  self.assertEqual([r[0]['value'] for r in rows('negative-limit-offset')],['2','1'])
if __name__=='__main__':unittest.main()
