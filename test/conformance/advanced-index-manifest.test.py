#!/usr/bin/env python3
import hashlib,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];SPEC=ROOT/'test/conformance/cases/stage3-advanced-index.spec.json';CAP=ROOT/'test/conformance/cases/stage3-advanced-index.json';MAN=ROOT/'reference/sqlite/manifest.json';UP=ROOT/'reference/sqlite/sqlite-src-3530400'
def text(c):return bytes.fromhex(c['utf8Hex']).decode()
class AdvancedIndexContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.s=json.loads(SPEC.read_text());cls.c=json.loads(CAP.read_text())
 def test_identity_accounting_and_provenance(self):
  m=json.loads(MAN.read_text());self.assertEqual((self.s['source']['version'],self.s['source']['sourceId']),(m['version'],m['sqliteSourceId']))
  self.assertEqual(self.c['accounting'],{'encodingVariants':3,'nativeCasesPerEncoding':10,'pinnedNativeCaptures':30,'attemptedPublicTsAssertions':0,'tsCreditedCases':0})
  self.assertFalse(self.s['execution']['publicTsAttempted']);self.assertFalse(self.s['execution']['publicTsCredited'])
  for a in self.s['upstreamAnchors']:
   source=(UP/a['path']).read_text()
   for symbol in a.get('symbols',[]):self.assertIn(symbol,source)
 def test_fixtures_layout_and_cross_encoding_results(self):
  self.assertEqual([(v['id'],v['encoding']) for v in self.c['variants']],[('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]);baseline=None
  for v in self.c['variants']:
   raw=(ROOT/v['fixture']['path']).read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest(),int.from_bytes(raw[16:18],'big')),(v['fixture']['bytes'],v['fixture']['sha256'],512))
   roots={text(r[1]):int(r[3]['value']) for r in v['fixture']['schema']};self.assertTrue({'wr','wr_c','p_live','e_expr','m_abc','ov','ov_k_payload'}<=roots.keys())
   x=v['fixture']['indexXinfo'];self.assertEqual([int(r[1]['value']) for r in x['sqlite_autoindex_wr_1']],[0,1,2,3]);self.assertEqual([int(r[1]['value']) for r in x['wr_c']],[2,0,1]);self.assertEqual([int(r[1]['value']) for r in x['e_expr'][:2]],[-2,-2])
   rows={c['id']:c['rows'] for c in v['cases']};self.assertEqual(rows,baseline or rows);baseline=rows
   self.assertEqual(rows['wr-secondary-suffix'][0][2],{'type':'text','utf8Hex':'7265616c'})
 def test_positive_and_negative_plan_neighbors(self):
  for v in self.c['variants']:
   cases={c['id']:c for c in v['cases']}
   for c in self.s['cases']:
    plan=' '.join(cases[c['id']]['eqp'])
    if 'requiresPlan' in c:self.assertIn(c['requiresPlan'],plan,c['id'])
    if 'forbidsPlan' in c:self.assertNotIn(c['forbidsPlan'],plan,c['id'])
   self.assertNotEqual(cases['partial-implied']['rows'],cases['partial-not-implied']['rows'])
   self.assertNotEqual(cases['expression-identical']['rows'],cases['expression-mismatch']['rows'])
 def test_native_work_lifecycle_errors_and_corruption(self):
  for v in self.c['variants']:
   # Every successful statement has bounded native counters and a selected-path
   # case does no full-scan work.
   for case in v['cases']:
    self.assertGreater(case['work']['vmSteps'],0);self.assertLess(case['work']['vmSteps'],500)
    self.assertLessEqual(case['work']['fullscanSteps'],4);self.assertLessEqual(case['work']['sortOperations'],4)
   selected=next(c for c in v['cases'] if c['id']=='wr-primary-exact');self.assertEqual(selected['work']['fullscanSteps'],0)
   lc=v['lifecycle'];self.assertEqual(lc['firstRows'],self.s['lifecycle']['expectedFirstRows']);self.assertEqual(lc['secondRows'],self.s['lifecycle']['expectedSecondRows']);self.assertEqual((lc['resetCode'],lc['clearBindingsCode'],lc['finalizeCode']),(0,0,0))
   errors={e['id']:e for e in v['errors']}
   for expected in self.s['errorCases']:
    got=errors[expected['id']];self.assertEqual(got['errorCode'],expected['errorCode']);self.assertEqual(got['reuseRows'],[[{'type':'integer','value':'4'}]])
    self.assertEqual(got['prepareCode']==0,expected['phase']=='runtime')
   self.assertEqual(set(errors),{e['id'] for e in self.s['errorCases']});self.assertEqual({e['limit']['category'] for e in self.s['errorCases'] if 'limit' in e},{'SQLITE_LIMIT_LENGTH','SQLITE_LIMIT_VARIABLE_NUMBER'})
   self.assertEqual(len(v['corruptions']),2);self.assertEqual({c['pageKind'] for c in v['corruptions']},{'btree-root','overflow'})
   expected={c['id']:c for c in self.s['corruptionCases']}
   for corruption in v['corruptions']:
    want=expected[corruption['id']];raw=(ROOT/corruption['fixture']['path']).read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest()),(corruption['fixture']['bytes'],corruption['fixture']['sha256']))
    self.assertEqual(corruption['offPathRows'],want['offPathRows']);self.assertEqual(corruption['reuseRows'],want['offPathRows']);self.assertEqual(corruption['selectedErrorCode'],want['selectedErrorCode']);self.assertIn('malformed',corruption['selectedMessage'])
    if corruption['pageKind']=='overflow':self.assertNotEqual(corruption['fixture']['damagedPage'],corruption['fixture']['selectedRootPage'])

if __name__=='__main__':unittest.main()
