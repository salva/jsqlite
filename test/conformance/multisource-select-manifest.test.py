import hashlib, json, pathlib, re, unittest
ROOT=pathlib.Path(__file__).parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-multisource-select.spec.json'
CAP=ROOT/'test/conformance/cases/stage3-multisource-select.json'
MAN=ROOT/'reference/sqlite/manifest.json'
UPSTREAM=ROOT/'reference/sqlite/sqlite-src-3530400'
ASSERTION_START=lambda aid: re.compile(r'(?m)^(?:do_[A-Za-z_]+_test|do_test)\s+'+re.escape(aid)+r'\s*\{')
def lines(path, span):
 text=path.read_text().splitlines(keepends=True); start,end=span
 if not (isinstance(start,int) and isinstance(end,int) and 1<=start<=end<=len(text)): raise AssertionError(f'invalid line span {span} for {path}')
 return ''.join(text[start-1:end])
def digest(text): return hashlib.sha256(text.encode()).hexdigest()
def assertion_block(path, assertion):
 text=path.read_text(); m=ASSERTION_START(assertion).search(text)
 if not m: raise AssertionError(f'{assertion} not found in {path}')
 e=re.search(r'(?m)^\}\s+\{.*\}\s*$',text[m.start():])
 if not e: raise AssertionError(f'{assertion} has no bounded expected-result line')
 return text[m.start():m.start()+e.end()]
class MultiSourceManifest(unittest.TestCase):
 def load(self): return json.loads(SPEC.read_text()),json.loads(CAP.read_text())
 def test_capture_is_exact_and_complete(self):
  s,c=self.load(); m=json.loads(MAN.read_text()); n=len(s['cases'])
  self.assertEqual(s['source']['version'],m['version']); self.assertEqual(s['source']['sourceId'],m['sqliteSourceId'])
  self.assertEqual(c['source'],s['source']); self.assertEqual(c['requiredCoverage'],s['requiredCoverage'])
  self.assertEqual(c['accounting'],{'declared':n,'nativeCaptured':n,'tsAttempted':0,'tsCredited':0})
  self.assertEqual([x['id'] for x in c['cases']],[x['id'] for x in s['cases']])
  covered={v for x in s['cases'] for v in x['coverage']}; self.assertEqual(covered,set(s['requiredCoverage']))
  byid={x['id']:x for x in s['cases']}
  for x in c['cases']:
   self.assertEqual(x['provenance'],byid[x['id']]['provenance'],x['id'])
   want=byid[x['id']].get('expect')=='prepare-error'
   self.assertEqual(x['native']['prepare']['kind']=='error',want,x['id'])
   if not want:self.assertIn(x['native']['first']['kind'],('done','error'))
 def test_every_case_has_content_addressed_pinned_provenance(self):
  s,_=self.load(); kinds=set()
  for case in s['cases']:
   p=case.get('provenance',{}); kind=p.get('kind'); kinds.add(kind); path=UPSTREAM/p.get('file','')
   self.assertTrue(path.is_file(),case['id']); self.assertTrue(p.get('adaptation','').strip(),case['id'])
   excerpt=lines(path,p.get('lines',[])); self.assertEqual(digest(excerpt),p.get('excerptSha256'),case['id'])
   if kind=='translated-upstream-assertion':
    block=assertion_block(path,p.get('assertion','')); self.assertIn(block.rstrip(),excerpt,case['id'])
    # Translation claims require the normalized case query to occur in the hashed assertion block.
    normalize=lambda x:' '.join(x.replace(';','').split()).casefold()
    self.assertIn(normalize(case['sql']),normalize(block),case['id'])
   elif kind=='synthesized-source-branch-discriminator':
    branch=p.get('branch','').strip(); symbol=p.get('ownerSymbol','').strip(); marker=p.get('branchMarker','').strip()
    self.assertTrue(branch and symbol and marker,case['id'])
    # Exact content-addressed owner span must contain both the declared owner/control symbol and branch marker.
    self.assertIn(symbol,excerpt,(case['id'],symbol))
    self.assertIn(marker,excerpt,(case['id'],marker))
   else:self.fail(f"{case['id']}: unknown/missing provenance kind {kind!r}")
  self.assertEqual(kinds,{'translated-upstream-assertion','synthesized-source-branch-discriminator'})
 def test_reviewed_provenance_misclassifications_cannot_recur(self):
  s,_=self.load(); byid={x['id']:x for x in s['cases']}
  for cid in ('comma-order','inner-on-alias','affinity-collation'):
   self.assertEqual(byid[cid]['provenance']['kind'],'synthesized-source-branch-discriminator')
  exact={x['provenance']['assertion'] for x in s['cases'] if x['provenance']['kind']=='translated-upstream-assertion'}
  self.assertEqual(exact,{'join-1.2.1','join-1.4.1','join-11.6'})
  self.assertIn('repeated-using-name',byid)
 def test_contract_has_no_runtime_evidence_claim(self):
  _,c=self.load(); self.assertEqual(c['accounting']['tsCredited'],0)
if __name__=='__main__':unittest.main()
