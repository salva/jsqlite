import hashlib, importlib.util, json, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
CAP=json.loads((ROOT/'test/conformance/cases/in-range-stat-native.json').read_text())
p=importlib.util.spec_from_file_location('producer',ROOT/'test/conformance/capture-in-range-stat.py')
producer=importlib.util.module_from_spec(p);p.loader.exec_module(producer)

class NativeInRangeStat(unittest.TestCase):
 def test_source_frozen_fixtures_and_access(self):
  self.assertEqual(CAP['sourceId'],json.loads((ROOT/'reference/sqlite/manifest.json').read_text())['sqliteSourceId'])
  self.assertEqual(len(CAP['variants']),6)
  for v in CAP['variants']:
   self.assertEqual(hashlib.sha256((ROOT/v['fixture']).read_bytes()).hexdigest(),v['sha256'])
   self.assertEqual(v['statTables'],[] if v['state']=='before' else ['sqlite_stat1'])
   case=v['cases']; selected=case['in-composite'];scan=case['in-composite-scan'];unforced=case['in-composite-unforced']
   self.assertEqual(selected['rows'],scan['rows']);self.assertEqual(selected['rows'],unforced['rows'])
   self.assertEqual([int(r[0]['value']) for r in selected['rows']],[13,214,1003,212,14,215,1004])
   self.assertTrue(all('SEARCH t USING INDEX t_ab (a=? AND b>? AND b<?)' in e for e in selected['eqp']))
   self.assertIn('SCAN t',scan['eqp']);self.assertGreater(scan['counters']['fullscanSteps'],300)
   self.assertEqual(selected['counters']['fullscanSteps'],0)
   self.assertEqual([int(r[0]['value']) for r in case['in-null']['rows']],[13,1002,214,1003])
   self.assertEqual(selected['rows'][2][-1],{'type':'text','utf8Hex':'636166c3a9'})
   self.assertEqual(case['in-null']['rows'][-1][-1],{'type':'integer','value':'14'})
   self.assertEqual(case['in-null']['counters']['fullscanSteps'],0)
   self.assertIn('SEARCH t USING COVERING INDEX t_ab (a=? AND b>? AND b<?)',case['in-null']['eqp'])
   ops=[r['opcode'] for r in selected['vdbe']]
   self.assertIn('OpenEphemeral',ops);self.assertEqual(ops.count('IdxInsert'),4)
   self.assertIn('Rewind',ops);self.assertIn('SeekGE',ops);self.assertIn('IdxGT',ops)
   rewind=next(r for r in selected['vdbe'] if r['opcode']=='Rewind');self.assertTrue(any(r['opcode']=='Next' and r['p1']==rewind['p1'] for r in selected['vdbe']), 'RHS cursor has a Next edge')
   self.assertGreaterEqual(ops.count('Next'),2) # RHS and selected index have separate iteration
 def test_analyze_changes_chosen_path_not_just_estimate(self):
  for encoding in ('utf8','utf16le','utf16be'):
   before,after=(next(v for v in CAP['variants'] if v['encoding']==encoding and v['state']==state) for state in ('before','after'))
   self.assertEqual(before['cases']['stat-choice']['rows'],after['cases']['stat-choice']['rows'])
   self.assertEqual(before['cases']['stat-choice']['eqp'],['SEARCH t USING INDEX t_a (a=?)'])
   self.assertEqual(after['cases']['stat-choice']['eqp'],['SEARCH t USING COVERING INDEX t_ab (a=? AND b=?)','USE TEMP B-TREE FOR ORDER BY'])
   stats={producer.m.text(r[1]):producer.m.text(r[2]) for r in after['stat1']}
   self.assertEqual(stats,{'t_a':'304 76','t_ab':'304 76 1','t_b':'304 2'})
   self.assertLess(after['cases']['stat-choice']['counters']['vmSteps'],before['cases']['stat-choice']['counters']['vmSteps'])
   self.assertEqual(before['cases']['in-composite']['eqp'],after['cases']['in-composite']['eqp'])

if __name__=='__main__':unittest.main()
