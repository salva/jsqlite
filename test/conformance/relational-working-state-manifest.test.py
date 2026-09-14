#!/usr/bin/env python3
import hashlib, json, pathlib, re, sys, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-relational-working-state.spec.json'
DATA=ROOT/'test/conformance/cases/stage3-relational-working-state.json'
PIN='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
class Manifest(unittest.TestCase):
 def setUp(self): self.s=json.loads(SPEC.read_text()); self.d=json.loads(DATA.read_text())
 def test_identity_schema_coverage_accounting(self):
  ref=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
  self.assertEqual((ref['version'],ref['sqliteSourceId']),('3.53.4',PIN))
  archive=ROOT/'reference/sqlite'/ref['archive']
  self.assertEqual(archive.stat().st_size,ref['bytes'])
  self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(),ref['sha256'])
  self.assertEqual(self.d['source'],self.s['source']); self.assertEqual(self.d['schema'],'jsqlite-relational-working-state/4')
  self.assertEqual(self.d['requiredCoverage'],self.s['requiredCoverage'])
  self.assertEqual(len(self.d['cases']),len(self.s['cases']))
  for expected,actual in zip(self.s['cases'],self.d['cases'],strict=True):
   projected={k:v for k,v in expected.items() if k!='capture'}
   self.assertEqual({k:actual[k] for k in projected},projected)
  got={v for c in self.d['cases'] for v in c['coverage']}; self.assertLessEqual(set(self.d['requiredCoverage']),got)
  a=self.d['accounting']; self.assertTrue(a['nativeExpectationsSeparateFromTsCredit']); self.assertTrue(a['countDerivedSuccessForbidden'])
  self.assertEqual(a['upstreamDeclared']+a['companionsDeclared'],len(self.d['cases']))
  self.assertEqual(a['nativeMatched'],len(self.d['cases'])); self.assertEqual(a['tsCreditedCases'],0)
 def test_literal_upstream_provenance(self):
  seen=set()
  for c in self.s['cases']:
   if c['credit']!='upstream': self.assertIn('sourceRationale',c); continue
   src=c['source']; key=(src['file'],src['assertionId'],src['occurrence']); self.assertNotIn(key,seen); seen.add(key)
   text=(ROOT/'reference/sqlite/sqlite-src-3530400'/src['file']).read_text()
   self.assertEqual(text.count(src['assertionAnchor']['text']),src['occurrence'])
   for anchor in src['setupAnchors']: self.assertEqual(text.count(anchor['text']),1)
 def test_operations_terminals_and_typed_rows(self):
  tags={'null','integer','real','text','blob'}
  for c in self.d['cases']:
   ops=c['operations']; n=c['native']; attempted=n['operationTrace']; un=n['unattempted']
   ai=[x['index'] for x in attempted]; ui=[x['index'] for x in un]
   self.assertEqual(ai,sorted(set(ai))); self.assertEqual(ui,sorted(set(ui))); self.assertEqual(sorted(ai+ui),list(range(len(ops))))
   for x in attempted+un:self.assertEqual(x['op'],ops[x['index']])
   t=n['terminal']; err=t.get('firstError'); meta=any(x['op']=='metadata' and x['outcome']=='passed' for x in attempted)
   self.assertEqual('columns' in n,meta)
   if t['kind']=='done': self.assertIn('rows',t); self.assertNotIn('partialRows',t)
   elif err['operation'] in ('openFixture','prepare'): self.assertNotIn('rows',t); self.assertNotIn('partialRows',t)
   else:self.assertIn('partialRows',t); self.assertNotIn('rows',t)
   for row in t.get('rows',t.get('partialRows',[])):
    for v in row:
     self.assertIn(v['type'],tags)
     if v['type']=='integer': self.assertRegex(v['value'],r'^-?\d+$')
     if v['type']=='real': self.assertRegex(v['ieee754be'],r'^[0-9a-f]{16}$')
     if v['type'] in ('text','blob'): self.assertRegex(v['utf8Hex' if v['type']=='text' else 'hex'],r'^(?:[0-9a-f]{2})*$')
 def test_ts_is_uncredited_and_readonly(self):
  for c in self.d['cases']:
   self.assertFalse(c['ts']['credit']); self.assertFalse(c['ts']['attempted'])
   self.assertTrue(re.match(r'^\s*(SELECT|WITH)\b',c['sql'],re.I),c['id'])
if __name__=='__main__':unittest.main()
