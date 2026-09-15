#!/usr/bin/env python3
import hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-compound-values.spec.json'; CAPTURE=ROOT/'test/conformance/cases/stage3-compound-values.json'; MANIFEST=ROOT/'reference/sqlite/manifest.json'
class CompoundValuesManifest(unittest.TestCase):
 def setUp(self): self.s=json.loads(SPEC.read_text());self.d=json.loads(CAPTURE.read_text())
 def test_identity_exact_projection_and_accounting(self):
  m=json.loads(MANIFEST.read_text()); self.assertEqual((m['version'],m['sqliteSourceId']),(self.s['source']['version'],self.s['source']['sourceId']))
  archive=ROOT/'reference/sqlite'/m['archive'];self.assertEqual(archive.stat().st_size,m['bytes']);self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),m['sha256'])
  self.assertEqual(self.d['schema'],'jsqlite-compound-values-contract/1');self.assertEqual(self.d['source'],self.s['source']);self.assertEqual(self.d['requiredCoverage'],self.s['requiredCoverage'])
  self.assertEqual([c['id'] for c in self.d['cases']],[c['id'] for c in self.s['cases']]);self.assertEqual(len(self.d['cases']),22)
  a=self.d['accounting'];self.assertEqual(a['declaredCases'],22);self.assertEqual(a['nativeMatched'],22);self.assertEqual(a['tsPrepareAttempts'],15);self.assertEqual(a['tsCreditedCases'],0);self.assertEqual(a['structuralGraphGate'],'external-corrected-query-graph')
  self.assertTrue(a['nativeExpectationsSeparateFromTsCredit']);self.assertTrue(a['countDerivedSuccessForbidden'])
  got={tag for c in self.d['cases'] for tag in c['coverage']};self.assertLessEqual(set(self.d['requiredCoverage']),got)
  for expected,actual in zip(self.s['cases'],self.d['cases'],strict=True):
   projected={k:v for k,v in expected.items() if k!='capture'};self.assertEqual({k:actual[k] for k in projected},projected)
   self.assertFalse(actual['ts']['credit']);self.assertEqual(bool(actual['ts']['attempted']),actual['native']['terminal'].get('firstError',{}).get('operation')!='prepare')
 def test_native_semantic_boundaries(self):
  c={x['id']:x for x in self.d['cases']}; rows=lambda i:c[i]['native']['terminal'].get('rows',[])
  self.assertEqual(len(rows('union-all-cardinality-order')),3);self.assertEqual(len(rows('union-distinct-cardinality')),2);self.assertEqual(len(rows('intersect-cardinality')),1);self.assertEqual(len(rows('except-cardinality')),1);self.assertEqual(len(rows('multirow-values')),3)
  self.assertEqual(c['leftmost-names-origin']['native']['columns'][0]['name'],'left_name');self.assertEqual(c['leftmost-names-origin']['native']['columns'][0]['declType'],'INTEGER')
  self.assertEqual(len(rows('compound-declared-collation')),1);self.assertEqual(len(rows('null-equality')),1);self.assertEqual(rows('integer-real-equality')[0][0]['type'],'real')
  self.assertEqual([r[0]['type'] for r in rows('integer-text-distinct')],['integer','text']);self.assertEqual([r[0]['type'] for r in rows('text-blob-distinct')],['text','blob'])
  errors={i:c[i]['native']['terminal']['firstError'] for i in ['multirow-values-order-limit','order-missing-alias-error','order-nonoutput-expression-error','arm-order-syntax-error','column-count-error','values-column-count-error','values-syntax-error']}
  self.assertTrue(all(e['operation']=='prepare' for e in errors.values()));self.assertEqual(c['limit-type-error']['native']['terminal']['firstError']['operation'],'stepAll')
if __name__=='__main__':unittest.main()
