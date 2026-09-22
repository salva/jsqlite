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
 def test_private_invariants_and_ts_credit_accounting(self):
  self.assertEqual(self.x['accounting'],{'encodingVariants':3,'pinnedCaptures':69,'attemptedPublicTsAssertions':69,'companions':0,'atomicUnattemptedGaps':5,'tsCreditedCases':69})
  fields=set(self.x['privateCounterContract']['fields'])
  self.assertEqual(fields,{'plannerCandidates','plannerPaths','indexSeeks','indexNext','tableSeeks','tableNext','residualTests','sorterRows'})
  index_seek={'index-equality','index-composite-prefix-range','index-null','order-unsatisfied-fallback','covering-index','deferred-table-lookup','parameter-reset-rebind','residual-predicate','up-index3-2.2','affinity-integer-text-positive','affinity-integer-text-negative','affinity-integer-blob-negative','affinity-real-text-positive','affinity-real-text-negative','affinity-real-null','orientation-commuted-integer'}
  index_advance={'index-equality','index-composite-prefix-range','order-unsatisfied-fallback','covering-index','deferred-table-lookup','parameter-reset-rebind','residual-predicate','affinity-integer-text-positive','orientation-commuted-integer'}
  table_seek={'rowid-equality','rowid-range-desc','order-unsatisfied-fallback','deferred-table-lookup','residual-predicate','left-join-on-provenance','left-join-where-safety','up-index3-2.2'}
  table_advance={'rowid-range-desc','left-join-on-provenance','left-join-where-safety','orientation-rhs-nocase','collation-binary-mismatch'}
  covering={'index-equality','index-composite-prefix-range','index-null','covering-index','parameter-reset-rebind','affinity-integer-text-positive','affinity-integer-text-negative','affinity-integer-blob-negative','orientation-commuted-integer'}
  index_full_scan={'affinity-text-numeric-positive'}
  table_full_scan={'orientation-rhs-nocase','collation-binary-mismatch'}
  sorter={'order-unsatisfied-fallback','residual-predicate','affinity-integer-text-positive','orientation-commuted-integer'}
  def lower(e): return e.get('exact',e.get('min'))
  def upper(e): return e.get('exact',e.get('max'))
  def zero(e): return e=={'exact':0}
  for v in self.x['variants']:
   for c in v['cases']:
    e=c['privateExpected']; cid=c['id']
    self.assertEqual(set(e),fields|{'freshEachRun'},cid);self.assertIs(e['freshEachRun'],True);self.assertTrue(c['ts']['credit']);self.assertEqual(c['ts']['unattempted'],[])
    for name in fields:
     bound=e[name];self.assertTrue(set(bound) in ({'exact'},{'min'},{'min','max'}),f'{cid}/{name}')
     self.assertIsInstance(lower(bound),int);self.assertGreaterEqual(lower(bound),0)
     if upper(bound) is not None:self.assertGreaterEqual(upper(bound),lower(bound))
    self.assertGreaterEqual(lower(e['plannerCandidates']),1);self.assertGreaterEqual(lower(e['plannerPaths']),1)
    if cid in index_seek:self.assertGreaterEqual(lower(e['indexSeeks']),1,cid)
    if cid in index_advance:self.assertGreaterEqual(lower(e['indexNext']),1,cid)
    if cid in table_seek:self.assertGreaterEqual(lower(e['tableSeeks']),1,cid)
    if cid in table_advance:self.assertGreaterEqual(lower(e['tableNext']),1,cid)
    if cid in covering:self.assertTrue(zero(e['tableSeeks']) and zero(e['tableNext']),cid)
    if cid in index_full_scan:self.assertTrue(zero(e['indexSeeks']) and zero(e['tableSeeks']) and zero(e['tableNext']),cid);self.assertGreaterEqual(lower(e['indexNext']),1,cid)
    if cid in table_full_scan:self.assertTrue(zero(e['indexSeeks']) and zero(e['indexNext']) and zero(e['tableSeeks']),cid);self.assertGreaterEqual(lower(e['tableNext']),1,cid)
    if cid in sorter:self.assertGreaterEqual(lower(e['sorterRows']),1,cid)
    elif 'ordering-satisfied' in c['coverage'] or 'covering' in c['coverage']:self.assertTrue(zero(e['sorterRows']),cid)
    for r in c['nativeRuns']:self.assertTrue(r['countersStartAtZero'])
  self.assertEqual(len(self.x['atomicGates']),5);self.assertTrue(all(not g['ts']['credit'] and not g['ts']['attempted'] for g in self.x['atomicGates']))
if __name__=='__main__':unittest.main()
