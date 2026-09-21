#!/usr/bin/env python3
import hashlib, json, pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-index-planner.spec.json'
CAPTURE=ROOT/'test/conformance/cases/stage3-index-planner.json'
MANIFEST=ROOT/'reference/sqlite/manifest.json'
UPSTREAM=ROOT/'reference/sqlite/sqlite-src-3530400'

class IndexPlannerContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.spec=json.loads(SPEC.read_text()); cls.capture=json.loads(CAPTURE.read_text())
  cls.cases={c['id']:c for c in cls.capture['cases']}

 def test_identity_fixture_schema_and_roots_are_exact(self):
  manifest=json.loads(MANIFEST.read_text()); cap=self.capture
  self.assertEqual(cap['source']['sourceId'],manifest['sqliteSourceId'])
  self.assertEqual(cap['source']['version'],manifest['version'])
  fixture=ROOT/cap['fixture']['path']; raw=fixture.read_bytes()
  self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest(),cap['fixture']['headerPageSize']),(cap['fixture']['bytes'],cap['fixture']['sha256'],512))
  schema={bytes.fromhex(r[1]['utf8Hex']).decode():(r[0],r[2],r[3]) for r in cap['fixture']['schema']}
  self.assertIn('sqlite_autoindex_t_1',schema)
  for name in ('t','u','ix_ab_desc','ix_c','sqlite_autoindex_t_1'):
   self.assertGreater(int(schema[name][2]['value']),0,name)
  auto=cap['fixture']['indexXinfo']['sqlite_autoindex_t_1']
  self.assertEqual(int(auto[0][1]['value']),5) # UNIQUE(tag), physical implicit autoindex identity

 def test_upstream_anchors_and_expected_assertion_are_bound(self):
  text=(UPSTREAM/'test/index3.test').read_text()
  self.assertIn('do_execsql_test index3-2.1',text); self.assertIn('do_execsql_test index3-2.2',text)
  self.assertIn('USING INDEX',text)
  for path,symbol in [('src/where.c','whereLoopAddBtreeIndex('),('src/wherecode.c','codeEqualityTerm('),('src/wherecode.c','sqlite3WhereCodeOneLoopStart(')]: self.assertIn(symbol,(UPSTREAM/path).read_text())
  self.assertEqual(self.cases['up-index3-2.2']['nativeRuns'][0]['rows'],[[{'type':'integer','value':'1'}]])

 def test_native_access_shapes_rows_and_real_class(self):
  by=self.cases
  self.assertTrue(any('USING INTEGER PRIMARY KEY' in q for q in by['rowid-equality']['nativeRuns'][0]['eqp']))
  self.assertTrue(any('COVERING INDEX ix_ab_desc' in q for q in by['covering-index']['nativeRuns'][0]['eqp']))
  self.assertTrue(any('USING INDEX ix_ab_desc' in q and 'COVERING' not in q for q in by['deferred-table-lookup']['nativeRuns'][0]['eqp']))
  self.assertTrue(any(op['opcode']=='DeferredSeek' for op in by['deferred-table-lookup']['nativeRuns'][0]['cursorProgram']))
  self.assertGreater(by['order-unsatisfied-fallback']['nativeRuns'][0]['work']['sortOperations'],0)
  self.assertEqual(by['index-equality']['nativeRuns'][0]['work']['sortOperations'],0)
  real=by['parameter-reset-rebind']['nativeRuns'][0]['rows'][0]
  self.assertEqual((bytes.fromhex(real[1]['utf8Hex']).decode(),real[2]['type']),('real','real'))
  self.assertNotEqual(by['parameter-reset-rebind']['nativeRuns'][0]['rows'],by['parameter-reset-rebind']['nativeRuns'][1]['rows'])
  self.assertEqual(by['residual-predicate']['nativeRuns'][0]['rows'],[[{'type':'integer','value':'1'}],[{'type':'integer','value':'2'}],[{'type':'integer','value':'3'}]])
  self.assertEqual(len(by['left-join-on-provenance']['nativeRuns'][0]['rows']),2)
  self.assertEqual(by['left-join-where-safety']['nativeRuns'][0]['rows'],[])

 def test_zero_credit_machine_accounting_and_atomic_gates(self):
  a=self.capture['accounting']; self.assertEqual(a,{'pinnedCaptures':13,'attemptedPublicTsAssertions':13,'companions':0,'atomicUnattemptedGaps':5,'tsCreditedCases':0})
  for case in self.capture['cases']:
   self.assertFalse(case['ts']['credit']); self.assertEqual(case['ts']['attempted'],['openFixture','prepare','stepAll']); self.assertEqual(case['ts']['unattempted'],['assertPrivatePlan','assertCursorWork'])
  self.assertEqual([g['feature'] for g in self.capture['atomicGates']],['WITHOUT ROWID','partial index','expression index','sqlite_stat-driven choice','index-backed IN'])
  for gate in self.capture['atomicGates']:
   self.assertEqual(gate['ts']['disposition'],'unattempted-atomic-zero-credit'); self.assertEqual(gate['ts']['attempted'],[]); self.assertFalse(gate['ts']['credit'])
  counters=self.capture['privateCounterContract']; self.assertIn('reset to zero',counters['scope']); self.assertEqual(len(counters['fields']),8)

if __name__=='__main__': unittest.main()
