import json, pathlib, re, unittest
ROOT=pathlib.Path(__file__).parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-multisource-select.spec.json'
CAP=ROOT/'test/conformance/cases/stage3-multisource-select.json'
MAN=ROOT/'reference/sqlite/manifest.json'
UPSTREAM=ROOT/'reference/sqlite/sqlite-src-3530400'
ASSERTION=re.compile(r'^[A-Za-z0-9_.-]+$')
SOURCE=re.compile(r'^src/[A-Za-z0-9_.-]+:[A-Za-z0-9_()/:= .>|-]+$')
NEIGHBOR=re.compile(r'^test/[A-Za-z0-9_.-]+#[A-Za-z0-9_.-]+$')
class MultiSourceManifest(unittest.TestCase):
 def test_capture_is_exact_and_complete(self):
  s=json.loads(SPEC.read_text()); c=json.loads(CAP.read_text()); m=json.loads(MAN.read_text())
  self.assertEqual(s['source']['version'],m['version']); self.assertEqual(s['source']['sourceId'],m['sqliteSourceId'])
  self.assertEqual(c['source'],s['source']); self.assertEqual(c['requiredCoverage'],s['requiredCoverage'])
  self.assertEqual(c['accounting'],{'declared':43,'nativeCaptured':43,'tsAttempted':0,'tsCredited':0})
  self.assertEqual([x['id'] for x in c['cases']],[x['id'] for x in s['cases']])
  covered={v for x in s['cases'] for v in x['coverage']}; self.assertEqual(covered,set(s['requiredCoverage']))
  byid={x['id']:x for x in s['cases']}
  for x in c['cases']:
   self.assertEqual(x['provenance'],byid[x['id']]['provenance'],x['id'])
   want=byid[x['id']].get('expect')=='prepare-error'
   self.assertEqual(x['native']['prepare']['kind']=='error',want,x['id'])
   if not want:self.assertIn(x['native']['first']['kind'],('done','error'))
 def test_every_case_has_durable_pinned_provenance(self):
  s=json.loads(SPEC.read_text()); kinds=set()
  for case in s['cases']:
   p=case.get('provenance',{}); kind=p.get('kind'); kinds.add(kind)
   if kind=='translated-upstream-assertion':
    self.assertRegex(p.get('assertion',''),ASSERTION,case['id'])
    path=UPSTREAM/p.get('file',''); self.assertTrue(path.is_file(),case['id'])
    text=path.read_text(errors='replace')
    self.assertRegex(text,rf'\b{re.escape(p["assertion"])}\s*\{{',case['id'])
   elif kind=='synthesized-source-branch-discriminator':
    self.assertTrue(p.get('sources'),case['id']); self.assertTrue(p.get('neighboringAssertions'),case['id'])
    for src in p['sources']:
     self.assertRegex(src,SOURCE,case['id']); rel,owner=src.split(':',1)
     path=UPSTREAM/rel; self.assertTrue(path.is_file(),case['id'])
     # At least the named routine/flag token must exist in the pinned owner file.
     tokens=re.findall(r'[A-Za-z_][A-Za-z0-9_]{3,}',owner)
     self.assertTrue(any(t in path.read_text(errors='replace') for t in tokens),case['id'])
    for ref in p['neighboringAssertions']:
     self.assertRegex(ref,NEIGHBOR,case['id']); rel,aid=ref.split('#',1)
     text=(UPSTREAM/rel).read_text(errors='replace')
     self.assertRegex(text,rf'\b{re.escape(aid)}\s*\{{',case['id'])
   else:self.fail(f"{case['id']}: unknown/missing provenance kind {kind!r}")
  self.assertEqual(kinds,{'translated-upstream-assertion','synthesized-source-branch-discriminator'})
 def test_contract_has_no_runtime_evidence_claim(self):
  c=json.loads(CAP.read_text()); self.assertEqual(c['accounting']['tsCredited'],0)
if __name__=='__main__':unittest.main()
