import json, pathlib, unittest
ROOT=pathlib.Path(__file__).parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-multisource-select.spec.json'
CAP=ROOT/'test/conformance/cases/stage3-multisource-select.json'
MAN=ROOT/'reference/sqlite/manifest.json'
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
   want=byid[x['id']].get('expect')=='prepare-error'
   self.assertEqual(x['native']['prepare']['kind']=='error',want,x['id'])
   if not want:self.assertIn(x['native']['first']['kind'],('done','error'))
 def test_contract_has_no_runtime_evidence_claim(self):
  c=json.loads(CAP.read_text()); self.assertEqual(c['accounting']['tsCredited'],0)
if __name__=='__main__':unittest.main()
