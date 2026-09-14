#!/usr/bin/env python3
import json, pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-order-limit-contract.spec.json'
CAPTURE=ROOT/'test/conformance/cases/stage3-order-limit-contract.json'
RELATIONAL=ROOT/'test/conformance/cases/stage3-relational-working-state.json'
MANIFEST=ROOT/'reference/sqlite/manifest.json'

class OrderLimitContract(unittest.TestCase):
 def test_capture_is_pinned_complete_and_zero_credit(self):
  spec=json.loads(SPEC.read_text()); capture=json.loads(CAPTURE.read_text()); manifest=json.loads(MANIFEST.read_text())
  self.assertEqual(capture['source']['sourceId'],manifest['sqliteSourceId'])
  self.assertEqual(capture['source']['version'],manifest['version'])
  self.assertEqual([c['id'] for c in capture['cases']],[c['id'] for c in spec['cases']])
  self.assertEqual(capture['accounting']['upstreamDeclared'],0)
  self.assertTrue(capture['accounting']['nativeExpectationsSeparateFromTsCredit'])
  for case in capture['cases']:
   self.assertEqual(case['credit'],'no-credit-contract',case['id'])
   self.assertFalse(case['ts']['credit'],case['id'])
   trace=case['native']['operationTrace']; unattempted=case['native']['unattempted']
   self.assertEqual(len(trace)+len(unattempted),len(case['operations']),case['id'])
   self.assertEqual(sorted(x['index'] for x in trace+unattempted),list(range(len(case['operations']))),case['id'])
  relational=json.loads(RELATIONAL.read_text())
  self.assertEqual(len(relational['cases']),18)
  self.assertEqual(sum(bool(c['ts']['credit']) for c in relational['cases']),1)

 def test_typed_native_boundaries_are_retained(self):
  cases={c['id']:c for c in json.loads(CAPTURE.read_text())['cases']}
  duplicate=cases['metadata-duplicate-columns']['native']
  self.assertEqual([c['name'] for c in duplicate['columns']],['a','a'])
  self.assertEqual([c['origin'] for c in duplicate['columns']],['a','a'])
  asc=cases['order-storage-asc']['native']['terminal']['rows']
  self.assertEqual([r[1]['type'] for r in asc],['null','integer','integer','real','integer','text','blob'])
  # Equal numeric keys are deliberately stabilized by rowid; no unspecified tie order is asserted.
  self.assertEqual([r[0].get('utf8Hex') for r in asc[1:4]],['6d696e7573','696e7465676572','7265616c'])
  for case_id in ['limit-null-error','limit-fraction-error','limit-text-error','limit-overflow-error']:
   error=cases[case_id]['native']['terminal']['firstError']
   self.assertEqual(error['operation'],'stepAll',case_id)
   self.assertEqual(error['primaryCode'],20,case_id)

if __name__=='__main__': unittest.main()
