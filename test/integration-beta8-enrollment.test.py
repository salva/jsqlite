"""Beta8 paired integration enrollment regression (harness, not SQL credit)."""
import json
import shutil
import subprocess
import os
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
RUNNER = ROOT / 'tools/test/integration.py'
runner = {'__name__': 'enrollment_test'}
# Avoid rewriting the preserved shared import cache.
exec(compile(RUNNER.read_text(), str(RUNNER), 'exec'), runner)


class Beta8Enrollment(unittest.TestCase):
    def test_three_function_pairs_plan_native_controls(self):
        library = pathlib.Path('/enrollment-test/not-loaded.so')
        work = pathlib.Path('/enrollment-test/not-created')
        for stem in ('select-collate-scalar-width',
                     'function-descriptor-resolution',
                     'function-registration-boundaries'):
            with self.subTest(pair=stem):
                consumer = f'test/conformance/{stem}.test.mjs'
                producer = f'test/conformance/{stem}-native.py'
                self.assertTrue((ROOT / consumer).is_file())
                self.assertTrue((ROOT / producer).is_file())
                self.assertIn(consumer, runner['discover_files'](ROOT))
                commands = runner['prerequisite_commands']([consumer], library, work)
                recipe = next(c for c in commands if 'tools/oracle/capture-expression-boundaries.py' in c)
                self.assertIn(str(work/'expression-boundaries'), recipe)
                self.assertIn(str(library.parent/'sqlite-fixture'), recipe)
                self.assertTrue(any('tools/test/verify-expression-capture.py' in c for c in commands))
                self.assertNotIn(['python3', producer, str(library)], commands,
                                 'native-only shared fixture check is not paired capture')

    def test_actual_cli_rejects_untracked_dependency_drift(self):
        # Isolated real Git/CLI fixture: no peer files or native SQL credit.
        for mode in ('stable', 'modify', 'add', 'delete'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(
                    prefix='beta8-input-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
                base = pathlib.Path(directory)
                root = base / 'source'
                root.mkdir()
                subprocess.run(['git', 'init', '-q', str(root)], check=True)
                target = root / 'tools/test/integration.py'
                target.parent.mkdir(parents=True)
                shutil.copyfile(RUNNER, target)
                subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
                subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                '-c', 'user.email=fixture@example.invalid',
                                'commit', '-qm', 'fixture'], check=True)
                producer = 'test/conformance/untracked-native.py'
                dependency = root / producer
                dependency.parent.mkdir(parents=True)
                dependency.write_text('# untracked producer bytes\n')
                consumer = 'test/conformance/input-control.test.mjs'
                operations = {
                    'stable': '',
                    'modify': f"fs.writeFileSync('{producer}', '# changed\\n');",
                    'delete': f"fs.unlinkSync('{producer}');",
                    'add': "fs.writeFileSync('test/conformance/new-native.py', '# new\\n');",
                }
                (root / consumer).write_text(
                    "import fs from 'node:fs';\n" + operations[mode] + '\n')
                work = base / 'work'
                env = dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work),
                           PYTHONDONTWRITEBYTECODE='1')
                result = subprocess.run(['python3', str(target), consumer],
                                        cwd=root, env=env, capture_output=True,
                                        text=True, timeout=20)
                report = json.loads((work / 'integration-run/manifest.json').read_text())
                self.assertIn(producer, report['inputs'])
                self.assertEqual(report['results'][0]['classification'], 'completed',
                                 result.stdout + result.stderr)
                expected = ([] if mode == 'stable' else
                            ['test/conformance/new-native.py'] if mode == 'add' else [producer])
                self.assertEqual(report['input_drift'], expected)
                self.assertEqual(result.returncode, int(mode != 'stable'))

    def test_actual_cli_rejects_generated_membership_drift(self):
        # Structural producer only: no library loaded, no native/SQL credit.
        for mode in ('stable', 'add', 'modify', 'delete'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(
                    prefix='beta8-generated-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
                base = pathlib.Path(directory)
                root = base / 'source'
                target = root / 'tools/test/integration.py'
                target.parent.mkdir(parents=True)
                shutil.copyfile(RUNNER, target)
                (target.parent / 'capture-prefix.py').write_text(
                    "import pathlib,sys\n"
                    "p=pathlib.Path(sys.argv[sys.argv.index('--output')+1]); "
                    "p.mkdir(parents=True); (p/'baseline.json').write_text('{}')\n")
                consumer = 'test/conformance/like-prefix-native-red.test.mjs'
                path = root / consumer
                path.parent.mkdir(parents=True)
                operations = {
                    'stable': '',
                    'add': "fs.mkdirSync(path.join(d,'nested')); fs.writeFileSync(path.join(d,'nested/added.json'),'{}');",
                    'modify': "fs.writeFileSync(path.join(d,'baseline.json'),'changed');",
                    'delete': "fs.unlinkSync(path.join(d,'baseline.json'));",
                }
                path.write_text("import fs from 'node:fs'; import path from 'node:path'; "
                    "const d=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'prefix-native'); "
                    + operations[mode] +
                    # Unrelated output must not cause false drift.
                    "fs.writeFileSync(path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'diagnostic.log'),'log');\n")
                subprocess.run(['git', 'init', '-q', str(root)], check=True)
                subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
                subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                '-c', 'user.email=fixture@example.invalid',
                                'commit', '-qm', 'fixture'], check=True)
                library = base / 'not-loaded.so'
                library.write_bytes(b'structural placeholder, never loaded')
                work = base / 'work'
                result = subprocess.run(['python3', str(target), '--oracle-library',
                                         str(library), consumer], cwd=root,
                    env=dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work),
                             PYTHONDONTWRITEBYTECODE='1'),
                    capture_output=True, text=True, timeout=20)
                report = json.loads((work / 'integration-run/manifest.json').read_text())
                self.assertEqual([p['exit'] for p in report['prerequisites']], [0])
                self.assertEqual([r['classification'] for r in report['results']], ['completed'])
                self.assertEqual(set(report['generated_inputs']), {'prefix-native/baseline.json'})
                changed = 'nested/added.json' if mode == 'add' else 'baseline.json'
                expected = [] if mode == 'stable' else [str(work / 'prefix-native' / changed)]
                self.assertEqual(report['input_drift'], expected)
                self.assertEqual(result.returncode, int(mode != 'stable'), result.stderr)

    def test_index_planner_fresh_cli_contract(self):
        consumer = 'test/conformance/run-index-planner-ts.mjs'
        producer = 'test/conformance/index-planner-typed-native.py'
        for mode in ('stable', 'drift', 'producer-failure'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(
                    prefix='beta8-index-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
                base = pathlib.Path(directory)
                root = base / 'source'
                target = root / 'tools/test/integration.py'
                target.parent.mkdir(parents=True)
                shutil.copyfile(RUNNER, target)
                work = base / 'work'
                library = base / 'not-loaded.so'
                library.write_bytes(b'placeholder never loaded')
                self.assertEqual(runner['prerequisite_commands']([consumer], library, work),
                    [['python3', producer, str(library), str(work/'index-planner-typed-native.json')]])
                p = root / producer
                p.parent.mkdir(parents=True)
                p.write_text("import pathlib,sys\nassert pathlib.Path(sys.argv[1]).is_file()\n" +
                    ("raise SystemExit(7)\n" if mode == 'producer-failure' else
                     "pathlib.Path(sys.argv[2]).write_text('{}')\n"))
                (root / consumer).write_text(
                    "import fs from 'node:fs'; import assert from 'node:assert/strict'; "
                    "import path from 'node:path'; const p=process.env.INDEX_PLANNER_TYPED_NATIVE; "
                    "assert.equal(p,path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'index-planner-typed-native.json')); "
                    "assert.equal(fs.readFileSync(p,'utf8'),'{}'); " +
                    ("fs.writeFileSync(p,'changed');" if mode == 'drift' else ''))
                subprocess.run(['git', 'init', '-q', str(root)], check=True)
                subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
                subprocess.run(['git', '-C', str(root), '-c', 'user.name=Fixture',
                                '-c', 'user.email=fixture@example.invalid',
                                'commit', '-qm', 'fixture'], check=True)
                result = subprocess.run(['python3', str(target), '--oracle-library', str(library), consumer],
                    cwd=root, env=dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work),
                        INDEX_PLANNER_TYPED_NATIVE='/foreign/not-used.json', PYTHONDONTWRITEBYTECODE='1'),
                    capture_output=True, text=True, timeout=20)
                report = json.loads((work/'integration-run/manifest.json').read_text())
                self.assertEqual(result.returncode, int(mode != 'stable'), result.stderr)
                self.assertEqual(report['fixture_environment']['INDEX_PLANNER_TYPED_NATIVE'],
                                 str(work/'index-planner-typed-native.json'))
                if mode == 'producer-failure':
                    self.assertEqual(report['prerequisites'][0]['exit'], 7)
                    self.assertEqual(report['not_run'], [consumer])
                    self.assertEqual(report['results'], [])
                else:
                    self.assertEqual(report['results'][0]['classification'], 'completed')
                    self.assertEqual(set(report['generated_inputs']), {'index-planner-typed-native.json'})
                    self.assertEqual(report['input_drift'], [] if mode == 'stable' else
                                     [str(work/'index-planner-typed-native.json')])

    def test_paired_actual_cli_drift_and_pin_controls(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required for pin controls')
        # Structural isolated receipt producer, not native/SQL credit. The real
        # source recipe is exercised separately on the combined checkout.
        consumer = 'test/conformance/select-collate-scalar-width.test.mjs'
        for mode in ('stable', 'receipt', 'db', 'source', 'generated', 'wrong-pin', 'missing-native', 'producer-failure'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix='beta8-pair-',
                    dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
                base = pathlib.Path(directory); root = base/'source'
                target = root/'tools/test/integration.py'; target.parent.mkdir(parents=True)
                shutil.copyfile(RUNNER, target)
                shutil.copyfile(ROOT/'tools/test/verify-expression-capture.py', target.parent/'verify-expression-capture.py')
                pin = root/'reference/sqlite/manifest.json'; pin.parent.mkdir(parents=True)
                manifest = json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
                if mode == 'wrong-pin': manifest['sqliteSourceId'] = 'wrong identity'
                pin.write_text(json.dumps(manifest))
                fixtures = root/'test/fixtures'; fixtures.mkdir(parents=True)
                (fixtures/'CURRENT.json').write_text('{"generationId":"test"}')
                generated = fixtures/'generations/test/generated'; generated.mkdir(parents=True)
                for enc in ('utf8','utf16le','utf16be'):
                    (generated/f'subquery-{enc}.db').write_bytes(b'structural DB identity')
                suite = root/consumer; suite.parent.mkdir(parents=True)
                for stem in runner['EXPRESSION_PAIRS']:
                    (suite.parent/f'{stem}-native.py').write_text('# structural\n')
                    (suite.parent/f'{stem}.test.mjs').write_text('// structural\n')
                operation = {
                    'receipt': "fs.writeFileSync(path.join(d,'receipt.json'),'{}');",
                    'db': "fs.appendFileSync(path.join(d,'subquery-utf8.db'),'changed');",
                    'source': "fs.appendFileSync('test/conformance/function-descriptor-resolution-native.py','# changed');",
                    'generated': "fs.writeFileSync(path.join(d,'unexpected.json'),'{}');",
                }.get(mode, '')
                suite.write_text("import fs from 'node:fs'; import path from 'node:path'; const d=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'expression-boundaries');" + operation)
                recipe = root/'tools/oracle/capture-expression-boundaries.py'; recipe.parent.mkdir(parents=True)
                recipe.write_text("import sys,pathlib,json,hashlib,shutil\n" +
                    ("raise SystemExit(7)\n" if mode == 'producer-failure' else '') +
                    "a=dict(zip(sys.argv[1::2],sys.argv[2::2])); o=pathlib.Path(a['--output']); o.mkdir(); files={}; commands=[]\n"
                    "def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()\n"
                    "for enc,n in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:\n"
                    " f='test/fixtures/generations/test/generated/subquery-'+enc+'.db'; db=o/('subquery-'+enc+'.db'); shutil.copyfile(f,db); files[f]=sha(f); commands.append({'argv':[a['--fixture-helper'],'subquery-'+enc,n,str(db)]})\n"
                    "for stem in ['select-collate-scalar-width','function-descriptor-resolution','function-registration-boundaries']:\n"
                    " n='test/conformance/'+stem+'-native.py'; p='test/conformance/'+stem+'.test.mjs'; files[n]=sha(n); files[p]=sha(p); commands.extend([{'argv':[sys.executable,n,a['--library']]},{'argv':[a['--node'],'--experimental-strip-types','--test','--test-concurrency=1','--test-timeout=100000',p]}])\n"
                    "for i,c in enumerate(commands):\n"
                    " p=o/(str(i)+'.txt'); p.write_text('structural'); c.update(output=p.name,sha256=sha(p),exit=0)\n"
                    "r={'schema':'expression-boundary-capture/1','generation':'test','files':files,'commands':commands,'executables':{str(pathlib.Path(a[k]).resolve()):sha(a[k]) for k in ['--library','--fixture-helper','--node']}}\n"
                    "(o/'receipt.json').write_text(json.dumps(r))\n")
                subprocess.run(['git','init','-q',str(root)],check=True)
                subprocess.run(['git','-C',str(root),'add','.'],check=True)
                subprocess.run(['git','-C',str(root),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture'],check=True)
                work = base/'work'
                result = subprocess.run(['python3',str(target),'--oracle-library',
                    str(base/'missing.so') if mode == 'missing-native' else library,consumer],cwd=root,
                    env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(work),PYTHONDONTWRITEBYTECODE='1'),
                    capture_output=True,text=True,timeout=20)
                report=json.loads((work/'integration-run/manifest.json').read_text())
                self.assertEqual(result.returncode,int(mode!='stable'),result.stdout+result.stderr)
                if mode in ('wrong-pin','missing-native','producer-failure'):
                    self.assertEqual(report['results'],[])
                    self.assertEqual(report['not_run'],[consumer])
                    self.assertEqual(report['prerequisites'][-1]['exit'],7 if mode=='producer-failure' else 1)
                    self.assertFalse((work/'expression-boundaries/receipt.json').exists())
                else:
                    self.assertEqual([p['exit'] for p in report['prerequisites']],[0,0,0])
                    self.assertEqual(report['results'][0]['classification'],'completed')
                    self.assertEqual(bool(report['input_drift']),mode!='stable')

    def test_wr_owned_cli_contract(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required for actual WR capture')
        consumer = 'test/schema/wr-declaration-identity.test.mjs'
        with tempfile.TemporaryDirectory(prefix='beta8-wr-',
                dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
            base = pathlib.Path(directory)
            for mode in ('stable', 'missing-native'):
                with self.subTest(mode=mode):
                    work = base / mode
                    selected = library if mode == 'stable' else str(base/'missing.so')
                    result = subprocess.run(['python3', str(RUNNER), '--oracle-library',
                        selected, consumer], cwd=ROOT,
                        env=dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work),
                            WR_FIXTURES='/foreign/never-write', WR_ORACLE='/foreign/never-load',
                            PYTHONDONTWRITEBYTECODE='1'), capture_output=True, text=True, timeout=40)
                    report = json.loads((work/'integration-run/manifest.json').read_text())
                    self.assertEqual(report['fixture_environment']['WR_FIXTURES'],
                                     str(work/'wr-declaration-native'))
                    self.assertEqual(report['fixture_environment']['WR_ORACLE'],
                                     str(pathlib.Path(selected).resolve()))
                    if mode == 'stable':
                        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
                        self.assertEqual([p['exit'] for p in report['prerequisites']], [0, 0])
                        self.assertEqual([r['classification'] for r in report['results']], ['completed'])
                        generated = report['generated_inputs']
                        self.assertIn('wr-declaration-native/native.json', generated)
                        self.assertGreaterEqual(sum(p.endswith('.db') for p in generated), 3)
                        self.assertEqual(report['input_drift'], [])
                    else:
                        self.assertEqual(result.returncode, 1)
                        self.assertEqual(report['prerequisites'][0]['exit'], 1)
                        self.assertEqual(report['results'], [])
                        self.assertEqual(report['not_run'], [consumer])
                        self.assertFalse((work/'wr-declaration-native').exists())

    def test_wr_actual_cli_negative_controls(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required for pin controls')
        consumer = 'test/schema/wr-declaration-identity.test.mjs'
        for mode in ('stable', 'wrong-pin', 'producer-failure', 'source', 'generated'):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(prefix='beta8-wr-controls-',
                    dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
                base = pathlib.Path(directory); root = base/'source'
                target = root/'tools/test/integration.py'; target.parent.mkdir(parents=True)
                shutil.copyfile(RUNNER, target)
                pin = root/'reference/sqlite/manifest.json'; pin.parent.mkdir(parents=True)
                manifest = json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
                if mode == 'wrong-pin': manifest['sqliteSourceId'] = 'wrong identity'
                pin.write_text(json.dumps(manifest))
                producer = root/'test/schema/capture-wr-declaration.py'
                producer.parent.mkdir(parents=True)
                producer.write_text('import os,pathlib\n' +
                    ('raise SystemExit(7)\n' if mode == 'producer-failure' else '') +
                    "p=pathlib.Path(os.environ['WR_FIXTURES']); p.mkdir(); (p/'native.json').write_text('{}')\n")
                operation = {'source': "fs.appendFileSync('test/schema/capture-wr-declaration.py','# changed');",
                    'generated': "fs.writeFileSync(process.env.WR_FIXTURES+'/added.db','changed');"}.get(mode, '')
                (root/consumer).write_text("import fs from 'node:fs';" + operation)
                subprocess.run(['git','init','-q',str(root)],check=True)
                subprocess.run(['git','-C',str(root),'add','.'],check=True)
                subprocess.run(['git','-C',str(root),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture'],check=True)
                work = base/'work'
                result = subprocess.run(['python3',str(target),'--oracle-library',library,consumer],cwd=root,
                    env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(work),PYTHONDONTWRITEBYTECODE='1',
                        WR_FIXTURES='/foreign/never-write',WR_ORACLE='/foreign/never-load'),
                    capture_output=True,text=True,timeout=20)
                report = json.loads((work/'integration-run/manifest.json').read_text())
                self.assertEqual(result.returncode,int(mode!='stable'),result.stdout+result.stderr)
                if mode in ('wrong-pin','producer-failure'):
                    self.assertEqual(report['results'],[])
                    self.assertEqual(report['not_run'],[consumer])
                    self.assertEqual(report['prerequisites'][-1]['exit'],1 if mode=='wrong-pin' else 7)
                    self.assertFalse((work/'wr-declaration-native').exists())
                else:
                    self.assertEqual([p['exit'] for p in report['prerequisites']],[0,0])
                    self.assertEqual(report['results'][0]['classification'],'completed')
                    self.assertEqual(bool(report['input_drift']),mode!='stable')

    def test_schema_identity_discovered_after_composition(self):
        # Discovery fixture only: no peer source adoption or fake SQL evidence.
        with tempfile.TemporaryDirectory(prefix='beta8-discovery-',
                dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
            root = pathlib.Path(directory)
            relative = 'test/schema/wr-declaration-identity.test.mjs'
            target = root / relative
            target.parent.mkdir(parents=True)
            target.write_text('// discovery fixture, never executed\n')
            self.assertIn(relative, runner['discover_files'](root),
                          'composed schema control must not be silently omitted')


if __name__ == '__main__':
    unittest.main()
