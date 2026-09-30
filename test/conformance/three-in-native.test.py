import hashlib, importlib.util, json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-three-in.py')
c=importlib.util.module_from_spec(p);p.loader.exec_module(c)
CAP=json.loads(c.OUT.read_text())
class ThreeInFrozen(unittest.TestCase):
 def test_identity_roots_and_cursor_access(self):
  self.assertEqual(CAP['sourceId'],c.SOURCE['sqliteSourceId'])
  self.assertEqual([v['encoding'] for v in CAP['variants']],['utf8','utf16le','utf16be'])
  for v in CAP['variants']:
   with self.subTest(v['encoding']):
    self.assertEqual(hashlib.sha256((ROOT/v['fixture']).read_bytes()).hexdigest(),v['sha256'])
    self.assertGreater(v['roots']['m_abc'],0)
    self.assertGreater(v['roots']['m'],0)
    single=v['cases']['single'];left=v['cases']['left'][0];scan=v['cases']['scan']
    self.assertEqual([r['rows'] for r in single],[r['rows'] for r in scan])
    self.assertEqual([len(r['rows']) for r in single],[4,4])
    self.assertEqual(len(left['rows']),5)
    self.assertEqual(left['rows'][-1],[{'type':'integer','value':'5'},{'type':'null'}])
    for case in (*single,left):
     self.assertTrue(any('USING COVERING INDEX m_abc' in line for line in case['eqp']))
     self.assertEqual(case['counters']['fullscanSteps'],0)
     ops=[op['opcode'] for op in case['vdbe']]
     self.assertGreaterEqual(ops.count('OpenEphemeral'),3)
     self.assertGreaterEqual(ops.count('Rewind'),3)
     self.assertGreaterEqual(ops.count('Next'),3)
     self.assertIn('SeekGE',ops);self.assertIn('IdxGT',ops)
     self.assertTrue(any(op['opcode']=='OpenRead' and op['p2']==v['roots']['m_abc'] for op in case['vdbe']))
    for case in scan:
     self.assertIn('SCAN m',case['eqp']);self.assertGreater(case['counters']['fullscanSteps'],0)
     self.assertNotIn('SeekGE',[op['opcode'] for op in case['vdbe']])
if __name__=='__main__':unittest.main()
