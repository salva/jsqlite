#!/usr/bin/env python3
import hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-index-planner.spec.json'; CAP=ROOT/'test/conformance/cases/stage3-index-planner.json'; MAN=ROOT/'reference/sqlite/manifest.json'; UP=ROOT/'reference/sqlite/sqlite-src-3530400'
def txt(c): return bytes.fromhex(c['utf8Hex']).decode()
class Contract(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.s=json.loads(SPEC.read_text());cls.x=json.loads(CAP.read_text())
 def test_pinned_producer_and_all_physical_encodings(self):
  m=json.loads(MAN.read_text());self.assertEqual((self.x['source']['sourceId'],self.x['source']['version']),(m['sqliteSourceId'],m['version']))
  self.assertEqual(self.x['producer'],{'script':'test/conformance/capture-index-planner.py','identityCheckedBeforeSetup':True,'reopenedReadOnly':True})
  self.assertEqual([(v['id'],v['encoding']) for v in self.x['variants']],[('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')])
  for v in self.x['variants']:
   f=ROOT/v['fixture']['path'];raw=f.read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest(),v['fixture']['headerPageSize']),(v['fixture']['bytes'],v['fixture']['sha256'],512))
   roots={txt(r[1]):int(r[3]['value']) for r in v['fixture']['schema']}
   for n in ('t','ix_ab_desc','ix_c','sqlite_autoindex_t_1','up_t1','sqlite_autoindex_up_t1_2'):self.assertGreater(roots[n],0)
   self.assertEqual(int(v['fixture']['indexXinfo']['sqlite_autoindex_t_1'][0][1]['value']),5)
 def test_source_affinity_and_direct_upstream_case(self):
  for p,symbol in [('src/where.c','whereScanNext('),('src/expr.c','sqlite3IndexAffinityOk('),('src/expr.c','sqlite3BinaryCompareCollSeq('),('src/whereexpr.c','exprCommute(')]:self.assertIn(symbol,(UP/p).read_text())
  self.assertIn('do_execsql_test index3-2.2',(UP/'test/index3.test').read_text())
  for v in self.x['variants']:
   c={c['id']:c for c in v['cases']}['up-index3-2.2'];self.assertEqual(c['nativeRuns'][0]['rows'],[[{'type':'integer','value':'5'}]]);self.assertIn('sqlite_autoindex_up_t1_2',c['nativeRuns'][0]['eqp'][0])
 def test_affinity_collation_rows_classes_and_shape_cross_encoding(self):
  required={'affinity-integer-text-positive','affinity-integer-text-negative','affinity-integer-blob-negative','affinity-text-numeric-positive','affinity-real-text-positive','affinity-real-text-negative','affinity-real-null','orientation-commuted-integer','orientation-rhs-nocase','collation-binary-mismatch'}
  baseline=None
  for v in self.x['variants']:
   cases={c['id']:c for c in v['cases']};self.assertTrue(required<=cases.keys())
   rows={i:cases[i]['nativeRuns'][0]['rows'] for i in required}
   if baseline is None:baseline=rows
   else:self.assertEqual(rows,baseline)
   self.assertEqual(rows['affinity-integer-text-positive'][0][1]['type'],'text') # typeof() result
   self.assertEqual(rows['affinity-integer-text-positive'][0][2]['type'],'integer')
   self.assertEqual(rows['affinity-real-text-positive'][0][2]['type'],'real')
   self.assertEqual(rows['affinity-integer-blob-negative'],[]);self.assertEqual(rows['affinity-real-text-negative'],[])
   self.assertTrue(any('ix_ab_desc' in q for q in cases['orientation-commuted-integer']['nativeRuns'][0]['eqp']))
   self.assertFalse(any('ix_ab_desc' in q for q in cases['collation-binary-mismatch']['nativeRuns'][0]['eqp']))
 def test_private_invariants_and_zero_credit_accounting(self):
  self.assertEqual(self.x['accounting'],{'encodingVariants':3,'pinnedCaptures':69,'attemptedPublicTsAssertions':69,'companions':0,'atomicUnattemptedGaps':5,'tsCreditedCases':0})
  fields=set(self.x['privateCounterContract']['fields'])
  for v in self.x['variants']:
   for c in v['cases']:
    self.assertTrue({'plannerCandidates','plannerPaths','indexSeeks','tableSeeks','sorterRows','residualTests'}<=c['privateExpected'].keys());self.assertTrue(c['privateExpected']['freshEachRun']);self.assertFalse(c['ts']['credit'])
    for name,e in c['privateExpected'].items():
     if name=='freshEachRun':continue
     self.assertIn(name,fields);self.assertEqual(len(set(e)&{'exact','min','max'}),1)
    for r in c['nativeRuns']:self.assertTrue(r['countersStartAtZero'])
  self.assertEqual(len(self.x['atomicGates']),5);self.assertTrue(all(not g['ts']['credit'] and not g['ts']['attempted'] for g in self.x['atomicGates']))
if __name__=='__main__':unittest.main()
