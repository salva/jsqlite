#!/usr/bin/env python3
import hashlib,json,pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];SPEC=ROOT/'test/conformance/cases/stage3-advanced-index.spec.json';CAP=ROOT/'test/conformance/cases/stage3-advanced-index.json';MAN=ROOT/'reference/sqlite/manifest.json';UP=ROOT/'reference/sqlite/sqlite-src-3530400'
def text(c):return bytes.fromhex(c['utf8Hex']).decode()
class AdvancedIndexContract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.s=json.loads(SPEC.read_text());cls.c=json.loads(CAP.read_text())
 def test_identity_accounting_and_provenance(self):
  m=json.loads(MAN.read_text());self.assertEqual((self.s['source']['version'],self.s['source']['sourceId']),(m['version'],m['sqliteSourceId']))
  self.assertEqual(self.c['accounting'],{'encodingVariants':3,'nativeCasesPerEncoding':10,'pinnedNativeCaptures':30,'attemptedPublicTsAssertions':30,'tsCreditedCases':24})
  self.assertTrue(self.s['execution']['publicTsAttempted']);self.assertTrue(self.s['execution']['publicTsCredited'])
  self.assertEqual(self.s['execution']['temporaryTsRejection'],
   'joined selected equality-prefix IN remains atomic temporary unsupported; unrepresented partial/expression shapes remain gated')
  self.assertEqual({c['id']:(c['futurePrivateExpected']['status'],c['futurePrivateExpected']['credit']) for c in self.s['cases'] if c['id'] in {'partial-implied','partial-not-implied','expression-identical','expression-mismatch'}},
   {'partial-implied':('passing',3),'partial-not-implied':('unattempted',0),'expression-identical':('passing',3),'expression-mismatch':('unattempted',0)})
  for a in self.s['upstreamAnchors']:
   source=(UP/a['path']).read_text()
   for symbol in a.get('symbols',[]):self.assertIn(symbol,source)
 def test_credit_ledger_reconciles_with_per_case_status(self):
  cases=self.s['cases'];variants=self.c['variants'];ledger=self.c['accounting']
  self.assertEqual(len({c['id'] for c in cases}),len(cases))
  self.assertEqual(len({v['id'] for v in variants}),len(variants))
  self.assertEqual(ledger['encodingVariants'],len(variants))
  self.assertEqual(ledger['nativeCasesPerEncoding'],len(cases))
  for v in variants:
   captured=[c['id'] for c in v['cases']]
   self.assertEqual(len(captured),len(set(captured)),v['id'])
   self.assertEqual(set(captured),{c['id'] for c in cases},v['id'])
  self.assertEqual(ledger['pinnedNativeCaptures'],sum(len(v['cases']) for v in variants))
  self.assertEqual(ledger['attemptedPublicTsAssertions'],len(cases)*len(variants))
  self.assertEqual(ledger['tsCreditedCases'],sum(c['futurePrivateExpected']['credit'] for c in cases))
  for c in cases:
   credit=c['futurePrivateExpected']['credit'];status=c['futurePrivateExpected']['status']
   self.assertIn(status,('passing','unattempted'),c['id'])
   self.assertEqual(credit,len(variants) if status=='passing' else 0,c['id'])
  self.assertEqual({c['id'] for c in cases if c['futurePrivateExpected']['status']=='unattempted'},
   {'partial-not-implied','expression-mismatch'})
 def test_reviewed_conformance_note_distinguishes_observation_from_credit(self):
  # The public physical probe in run-advanced-index-ts.test.mjs observes both
  # selected roots; this prose must not again call that observation a scan.
  section=(ROOT/'docs/CONFORMANCE.md').read_text().split('## Advanced-index execution and credit boundary',1)[1].split('\n## ',1)[0]
  credited_intro=section.split('The two negative',1)[0]
  self.assertEqual(int(re.search(r'credits \*\*(\d+) encoding/case pairs\*\*',credited_intro).group(1)),
   self.c['accounting']['tsCreditedCases'])
  self.assertEqual(set(re.findall(r'`([^`]+)`',credited_intro)),
   {c['id'] for c in self.s['cases'] if c['futurePrivateExpected']['status']=='passing'})
  self.assertEqual(set(re.findall(r'`([^`]+)`',section.split('The two negative',1)[1].split('pairs are attempted',1)[0])),
   {c['id'] for c in self.s['cases'] if c['futurePrivateExpected']['status']=='unattempted'})
  for case,root in [('partial-implied','p_live'),('expression-identical','e_expr')]:
   self.assertIn(f'`{case}`',section)
   self.assertIn(f'`{root}`',section)
  self.assertIn('physically opened',section)
  self.assertIn('zero selected-access credit',section)
  self.assertIn('selected-access eligibility',section)
  self.assertIn('general optimizer parity',section)
  self.assertNotIn('not evidence that a partial or expression index was selected',section)
 def test_fixtures_layout_and_cross_encoding_results(self):
  self.assertEqual([(v['id'],v['encoding']) for v in self.c['variants']],[('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]);baseline=None
  for v in self.c['variants']:
   raw=(ROOT/v['fixture']['path']).read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest(),int.from_bytes(raw[16:18],'big')),(v['fixture']['bytes'],v['fixture']['sha256'],512))
   roots={text(r[1]):int(r[3]['value']) for r in v['fixture']['schema']};self.assertTrue({'wr','wr_c','p_live','e_expr','m_abc','ov','ov_k_payload'}<=roots.keys())
   x=v['fixture']['indexXinfo'];self.assertEqual([int(r[1]['value']) for r in x['sqlite_autoindex_wr_1']],[0,1,2,3]);self.assertEqual([int(r[1]['value']) for r in x['wr_c']],[2,0,1]);self.assertEqual([int(r[1]['value']) for r in x['e_expr'][:2]],[-2,-2])
   rows={c['id']:c['rows'] for c in v['cases']};self.assertEqual(rows,baseline or rows);baseline=rows
   self.assertEqual(rows['wr-secondary-suffix'][0][2],{'type':'text','utf8Hex':'7265616c'})
 def test_without_rowid_secondary_pk_mapping_shapes(self):
  self.assertEqual([c['id'] for c in self.s['secondaryPrimaryKeyMappingCases']],['mixed-declared-auxiliary','reordered-interspersed','all-pk-declared-no-suffix','collation-duplicate'])
  for v in self.c['variants']:
   roots={text(r[1]) for r in v['fixture']['schema']};self.assertTrue({'wr_map','wr_map_mixed','wr_map_reordered','wr_map_all','wr_map_collation'}<=roots)
   x=v['fixture']['indexXinfo']
   # cid sequences prove native SQLite's mixed/reordered/no-suffix and
   # different-collation appended-copy physical layouts.
   self.assertEqual([int(r[1]['value']) for r in x['wr_map_mixed']],[0,2,1])
   self.assertEqual([int(r[1]['value']) for r in x['wr_map_reordered']],[1,2,0])
   self.assertEqual([int(r[1]['value']) for r in x['wr_map_all']],[1,2,0])
   self.assertEqual([int(r[1]['value']) for r in x['wr_map_collation']],[0,2,0,1])
  self.assertEqual([c['physicalPkFields'] for c in self.s['secondaryPrimaryKeyMappingCases']],[[0,2],[2,0],[2,0],[2,3]])
 def test_positive_and_negative_plan_neighbors(self):
  for v in self.c['variants']:
   cases={c['id']:c for c in v['cases']}
   for c in self.s['cases']:
    plan=' '.join(cases[c['id']]['eqp'])
    if 'requiresPlan' in c:self.assertIn(c['requiresPlan'],plan,c['id'])
    if 'forbidsPlan' in c:self.assertNotIn(c['forbidsPlan'],plan,c['id'])
   self.assertNotEqual(cases['partial-implied']['rows'],cases['partial-not-implied']['rows'])
   self.assertNotEqual(cases['expression-identical']['rows'],cases['expression-mismatch']['rows'])
 def test_exact_per_case_and_companion_provenance(self):
  required={c['provenanceId'] for c in self.s['cases']}|{self.s['lifecycle']['provenanceId']}|{e['provenanceId'] for e in self.s['errorCases']}|{c['provenanceId'] for c in self.s['corruptionCases']}
  self.assertEqual(required,set(self.s['exactProvenance']))
  for pid,pv in self.s['exactProvenance'].items():
   source=(UP/pv['path']).read_text().splitlines(True);a,b=pv['lineRange'];block=''.join(source[a-1:b]);self.assertEqual(hashlib.sha256(block.encode()).hexdigest(),pv['textSha256'],pid)
   if pv['kind']=='upstream-test-assertion':self.assertRegex(block,r'(do_execsql_test|do_test)\s+'+re.escape(pv['assertionId'])+r'\s*\{')
   if pv.get('category')=='composite-range':
    self.assertTrue({'whereLoopAddBtreeIndex','sqlite3WhereCodeOneLoopStart'}<=set(pv['owners']));self.assertGreaterEqual(len(pv['branchMarkers']),3)
    for marker in pv['branchMarkers']:self.assertIn(marker,block)
    extra=pv.get('additionalRangeBranch')
    if extra:
     lines=(UP/extra['path']).read_text().splitlines(True);a,b=extra['lineRange'];more=''.join(lines[a-1:b]);self.assertEqual(hashlib.sha256(more.encode()).hexdigest(),extra['textSha256'])
     for marker in extra['branchMarkers']:self.assertIn(marker,more)
  for case in self.s['cases']:
   r=case['provenanceRationale'];self.assertGreater(len(r['inheritedBehavior']),20);self.assertGreater(len(r['localCaptureEstablishes']),20)
   if 'range' in case.get('coverage',[]) or case['id'] in {'composite-equality-two-ranges','multiple-range-neighbor'}:
    pv=self.s['exactProvenance'][case['provenanceId']]
    if case['id'] in {'composite-equality-two-ranges','multiple-range-neighbor'}:self.assertEqual(pv.get('category'),'composite-range');self.assertEqual(pv['kind'],'source-range');self.assertNotEqual(pv['path'],'test/in4.test')
 def test_frozen_partial_expression_selected_credit_requires_physical_access(self):
  frozen={'partial-implied','partial-not-implied','expression-identical','expression-mismatch'}
  expected_roots={'partial-implied':'p_live','partial-not-implied':None,'expression-identical':'e_expr','expression-mismatch':None}
  self.assertEqual({c['id'] for c in self.s['cases'] if c['futurePrivateExpected']['status']=='unattempted'}, {'partial-not-implied','expression-mismatch'})
  for variant in self.c['variants']:
   cases={c['id']:c for c in variant['cases']}
   self.assertEqual(set(cases),{c['id'] for c in self.s['cases']})
   for case in self.s['cases']:
    captured=cases[case['id']]
    self.assertEqual(captured['sql'],case['sql'])
    self.assertEqual(captured['bindings'],case['bindings'])
    if case['id'] not in frozen:continue
    self.assertTrue(captured['rows'],(variant['id'],case['id']))
    self.assertEqual((case['futurePrivateExpected']['status'],case['futurePrivateExpected']['credit']),('passing',3) if case['id'] in {'partial-implied','expression-identical'} else ('unattempted',0))
    root=expected_roots[case['id']]
    # Keep the declared physical root in the future private contract tied to
    # the independent native plan, even while selected-access credit is zero.
    self.assertEqual(case['futurePrivateExpected']['selectedRoot'],root or ('p' if case['id']=='partial-not-implied' else 'e'),(variant['id'],case['id']))
    if root:
     self.assertEqual(captured['eqp'],['SEARCH '+('p' if root=='p_live' else 'e')+' USING INDEX '+root+(' (a=?)' if root=='p_live' else ' (<expr>=? AND <expr>=?)')],(variant['id'],case['id']))
    else:
     self.assertEqual(captured['eqp'],['SCAN p','USE TEMP B-TREE FOR ORDER BY'] if case['id']=='partial-not-implied' else ['SCAN e'],(variant['id'],case['id']))
   self.assertNotEqual(cases['partial-implied']['rows'],cases['partial-not-implied']['rows'])
   self.assertNotEqual(cases['expression-identical']['rows'],cases['expression-mismatch']['rows'])
  self.assertEqual(sum(c['futurePrivateExpected']['credit'] for c in self.s['cases']),self.c['accounting']['tsCreditedCases'])
 def test_frozen_selected_roots_have_exact_pinned_physical_key_metadata(self):
  # sqlite_master rootpage identifies the selected btree; index_xinfo identifies
  # the declared key fields and hidden rowid tail, not just an EQP name.
  for variant in self.c['variants']:
   fixture=variant['fixture'];roots={text(r[1]):int(r[3]['value']) for r in fixture['schema']}
   self.assertGreater(roots['p_live'],1,variant['id']);self.assertGreater(roots['e_expr'],1,variant['id'])
   self.assertNotIn(roots['p_live'],{roots['p'],roots['e'],roots['e_expr']})
   self.assertNotIn(roots['e_expr'],{roots['p'],roots['e']})
   for name,expected in [('p_live',[(1,'a','BINARY',1),(2,'b','BINARY',1),(-1,None,'BINARY',0)]),('e_expr',[(-2,None,'BINARY',1),(-2,None,'BINARY',1),(-1,None,'BINARY',0)])]:
    rows=fixture['indexXinfo'][name]
    actual=[(int(row[1]['value']),None if row[2]['type']=='null' else text(row[2]),text(row[4]),int(row[5]['value'])) for row in rows]
    self.assertEqual(actual,expected,(variant['id'],name))
    self.assertEqual([int(row[0]['value']) for row in rows],[0,1,2],(variant['id'],name))
    self.assertEqual([int(row[3]['value']) for row in rows],[0,0,0],(variant['id'],name))
 def test_private_access_contract_is_complete_and_scoped(self):
  required={'plannerCandidates','plannerPaths','indexSeeks','indexNext','tableSeeks','tableNext','residualTests','sorterRows','inProbes'}
  seen=set();captured={c['id']:c for c in self.c['variants'][0]['cases']}
  for case in self.s['cases']:
   p=case['futurePrivateExpected'];expected=('unattempted',0) if case['id'] in {'partial-not-implied','expression-mismatch'} else ('passing',3);self.assertEqual((p['status'],p['credit'],p['freshEachRun']),(*expected,True));self.assertTrue(p['selectedRoot']);self.assertTrue(p['cursorRoles']);self.assertIn(p['accessMode'],{'covering','deferred-unused','deferred-base','base-scan'});self.assertEqual(set(p['counters']),required)
   for name,bound in p['counters'].items():
    self.assertIn(set(bound),[{'exact'},{'min'},{'min','max'}]);self.assertTrue(all(isinstance(v,int) and v>=0 for v in bound.values()));lo=bound.get('min',bound.get('exact'));hi=bound.get('max',bound.get('exact',lo));self.assertLessEqual(lo,hi)
   self.assertGreater(p['counters']['plannerCandidates'].get('min',0),0);self.assertGreater(p['counters']['plannerPaths'].get('min',0),0);seen.add((p['selectedRoot'],p['accessMode']))
   is_in=bool(re.search(r'\bIN\s*\(',case['sql'],re.I));probes=p['counters']['inProbes']
   if is_in:
    rhs=case['sql'].split(' IN (',1)[1].split(')',1)[0];distinct=len(set(re.findall(r'\?\d+',rhs)));self.assertGreater(distinct,0);self.assertEqual(probes,{'exact':distinct});self.assertEqual(p['derivation']['distinctInRhsProbes'],distinct);self.assertEqual(p['counters']['indexSeeks'],{'exact':distinct})
   else:self.assertEqual(probes,{'exact':0})
   returned=len(captured[case['id']]['rows']);self.assertEqual(p['derivation']['returnedRows'],{'exact':returned})
   if p['accessMode']=='base-scan':
    cardinality=p['derivation']['fullScanCardinality'];self.assertGreater(cardinality,returned);self.assertEqual(p['counters']['residualTests'],{'exact':cardinality});self.assertEqual(p['counters']['tableNext'],{'min':cardinality-1,'max':cardinality})
   if p['accessMode'] in {'covering','deferred-unused'}:self.assertEqual((p['counters']['tableSeeks'],p['counters']['tableNext']),({'exact':0},{'exact':0}))
   if p['accessMode']=='deferred-base':self.assertEqual(p['counters']['tableSeeks'],{'exact':returned})
   has_sort='USE TEMP B-TREE' in ' '.join(captured[case['id']]['eqp']);sort_min=p['counters']['sorterRows'].get('exact',p['counters']['sorterRows'].get('min',0));self.assertGreaterEqual(sort_min,returned if has_sort else 0)
  self.assertGreaterEqual(len(seen),7);self.assertEqual(self.c['accounting']['attemptedPublicTsAssertions'],30);self.assertEqual(self.c['accounting']['tsCreditedCases'],24)
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
    self.assertEqual(got['phase'],expected['phase']);self.assertEqual(got['stepCode'],None)
    if expected['phase']=='bind':self.assertEqual((got['prepareCode'],got['bindCode']),(0,expected['errorCode']))
    if expected['phase']=='prepare':self.assertNotEqual(got['prepareCode'],0);self.assertIsNone(got['bindCode'])
   self.assertEqual(set(errors),{e['id'] for e in self.s['errorCases']});self.assertEqual({e['limit']['category'] for e in self.s['errorCases'] if 'limit' in e},{'SQLITE_LIMIT_LENGTH','SQLITE_LIMIT_VARIABLE_NUMBER'})
   self.assertEqual(len(v['corruptions']),2);self.assertEqual({c['pageKind'] for c in v['corruptions']},{'btree-root','overflow'})
   expected={c['id']:c for c in self.s['corruptionCases']}
   for corruption in v['corruptions']:
    want=expected[corruption['id']];raw=(ROOT/corruption['fixture']['path']).read_bytes();self.assertEqual((len(raw),hashlib.sha256(raw).hexdigest()),(corruption['fixture']['bytes'],corruption['fixture']['sha256']))
    self.assertEqual(corruption['offPathRows'],want['offPathRows']);self.assertEqual(corruption['reuseRows'],want['offPathRows']);self.assertEqual(corruption['selectedErrorCode'],want['selectedErrorCode']);self.assertIn('malformed',corruption['selectedMessage'])
    if corruption['pageKind']=='overflow':self.assertNotEqual(corruption['fixture']['damagedPage'],corruption['fixture']['selectedRootPage'])

if __name__=='__main__':unittest.main()
