"""Actual-CLI guard for Q19's unenrolled beta7 native consumers.

This is prerequisite coverage, not SQLite semantic credit. Keep separate from
approved historical inventory controls in integration-runner.test.py.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import shutil
import hashlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
CONSUMERS = [
    'test/conformance/column-default' + suffix + '.test.mjs'
    for suffix in ('', '-affinity', '-branches', '-cast', '-empty', '-float',
                   '-quoted', '-raw-token')
] + [
    'test/conformance/like-prefix-composite.test.mjs',
    'test/conformance/like-prefix-composite-red.test.mjs',
]


class NativeEnrollment(unittest.TestCase):
    def test_native_generated_integrity_actual_cli(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required for native integrity controls')
        node = shutil.which('node')
        self.assertIsNotNone(node)
        for directory, consumer, receipt in (
            ('default-native', CONSUMERS[0], 'column-default-original-native.json'),
            ('prefix-composite-native', CONSUMERS[-1], 'like-prefix-composite-native.json'),
        ):
            for action in ('mutate', 'delete', 'nonfile'):
                with self.subTest(directory=directory, action=action):
                    root = pathlib.Path(tempfile.mkdtemp(prefix='beta7-drift-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
                    binary = root/'bin'
                    binary.mkdir()
                    shim = binary/'node'
                    relative = f'{directory}/test/conformance/cases/{receipt}'
                    change = {'mutate':'p.write_text("{}")', 'delete':'p.unlink()', 'nonfile':'p.unlink(); p.mkdir()'}[action]
                    shim.write_text('#!'+sys.executable+'\nimport os,pathlib,sys\n'
                                    +'if sys.argv[1:]==["--version"]: os.execv('+repr(node)+',["node","--version"])\n'
                                    +'p=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/'+repr(relative)+'\n'
                                    +change+'\n')
                    shim.chmod(0o755)
                    env = dict(os.environ, PATH=str(binary)+os.pathsep+os.environ['PATH'],
                               SAIVAGE_CARD_WORK_ROOT=str(root/'run'), PYTHONDONTWRITEBYTECODE='1')
                    result = subprocess.run([sys.executable, 'tools/test/integration.py', '--oracle-library', library, consumer],
                                            cwd=ROOT, env=env, capture_output=True, text=True, timeout=180)
                    (root/'cli.stdout').write_text(result.stdout)
                    (root/'cli.stderr').write_text(result.stderr)
                    report = json.loads((root/'run/integration-run/manifest.json').read_text())
                    self.assertEqual(result.returncode, 1, str(root))
                    self.assertEqual([p['exit'] for p in report['prerequisites']], [0], str(root))
                    self.assertEqual([r['exit'] for r in report['results']], [0], str(root))
                    self.assertEqual(report['not_run'], [])
                    self.assertEqual(report['input_drift'], [str(root/'run'/relative)])
                    generated = report['generated_inputs']
                    self.assertIn(f'{directory}/reference/sqlite/manifest.json', generated)
                    self.assertIn(f'{directory}/test/conformance/capture-index-planner.py', generated)
                    self.assertIn(relative, generated)
                    self.assertEqual(len([p for p in generated if p.endswith('.db')]), 6 if directory=='default-native' else 3)

    def test_native_rejection_boundaries_actual_cli(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required')
        for mode, consumer, directory, receipt in (
            ('default', CONSUMERS[0], 'default-native', 'column-default-native.json'),
            ('prefix', CONSUMERS[-1], 'prefix-composite-native', 'like-prefix-composite-native.json'),
        ):
            for action in ('version', 'sourceid', 'receipt', 'database', 'stale'):
                with self.subTest(mode=mode, action=action):
                    root = pathlib.Path(tempfile.mkdtemp(prefix='beta7-reject-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
                    checkout = root/'checkout'
                    checkout.mkdir()
                    names = ['tools/test/integration.py', 'tools/test/capture-default.py', 'tools/test/capture-prefix.py',
                             'reference/sqlite/manifest.json', 'test/conformance/capture-index-planner.py', consumer]
                    patterns = (('capture-column-default*.py', 'cases/column-default*-native.json', 'fixtures/column-default*.db')
                                if mode=='default' else ('capture-like-prefix.py', 'cases/like-prefix-composite-native.json', 'fixtures/like-prefix-composite*.db'))
                    for pattern in patterns:
                        names.extend(str(p.relative_to(ROOT)) for p in (ROOT/'test/conformance').glob(pattern))
                    for name in set(names):
                        target = checkout/name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(ROOT/name, target)
                    subprocess.run(['git', 'init', '-q'], cwd=checkout, check=True)
                    subprocess.run(['git', '-c', 'user.name=Harness', '-c', 'user.email=harness@example.invalid',
                                    'commit', '--allow-empty', '-qm', 'disposable harness boundary'], cwd=checkout, check=True)
                    if action in ('version', 'sourceid'):
                        path = checkout/'reference/sqlite/manifest.json'
                        pin = json.loads(path.read_text())
                        pin['version' if action=='version' else 'sqliteSourceId'] = 'wrong-identity'
                        path.write_text(json.dumps(pin))
                    elif action == 'receipt':
                        path = checkout/'test/conformance/cases'/receipt
                        value = json.loads(path.read_text())
                        value['variants'][0]['cases'][0]['native']['rows'] = []
                        path.write_text(json.dumps(value))
                    elif action == 'database':
                        value = json.loads((checkout/'test/conformance/cases'/receipt).read_text())
                        (checkout/value['variants'][0]['fixture']).write_bytes(b'mismatched database')
                    else:
                        (root/'run'/directory).mkdir(parents=True)
                    env = dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(root/'run'), PYTHONDONTWRITEBYTECODE='1')
                    result = subprocess.run([sys.executable, 'tools/test/integration.py', '--oracle-library', library, consumer],
                                            cwd=checkout, env=env, capture_output=True, text=True, timeout=180)
                    (root/'cli.stdout').write_text(result.stdout)
                    (root/'cli.stderr').write_text(result.stderr)
                    report = json.loads((root/'run/integration-run/manifest.json').read_text())
                    self.assertEqual(result.returncode, 1, str(root))
                    self.assertEqual(report['results'], [], str(root))
                    self.assertEqual(report['not_run'], [consumer])
                    self.assertEqual(len(report['prerequisites']), 1)
                    self.assertNotEqual(report['prerequisites'][0]['exit'], 0)
                    if action in ('version', 'sourceid'):
                        self.assertFalse((root/'run'/directory).exists(), str(root))

    def test_missing_oracle_prevents_all_affected_consumers(self):
        # Retain the real CLI manifest/logs even on failure. No Node shim and no
        # native library are needed to demonstrate the trust-boundary failure.
        root = pathlib.Path(tempfile.mkdtemp(
            prefix='beta7-enrollment-missing-',
            dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
        missing = root / 'nonexistent-native.so'
        self.assertFalse(missing.exists())
        env = dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(root / 'run'),
                   PYTHONDONTWRITEBYTECODE='1')
        result = subprocess.run(
            [sys.executable, 'tools/test/integration.py', '--oracle-library',
             str(missing), *CONSUMERS], cwd=ROOT, env=env,
            capture_output=True, text=True, timeout=180)
        (root / 'cli.stdout').write_text(result.stdout)
        (root / 'cli.stderr').write_text(result.stderr)
        report = json.loads((root / 'run/integration-run/manifest.json').read_text())
        detail = f'retained actual CLI evidence: {root}'
        # Check every requirement independently so a misleading aggregate exit
        # alone cannot hide consumers that already ran without prerequisites.
        with self.subTest('aggregate rejects missing oracle'):
            self.assertNotEqual(result.returncode, 0, detail)
        with self.subTest('no consumer execution'):
            self.assertEqual(report['results'], [], detail)
        with self.subTest('all affected consumers explicitly not run'):
            self.assertEqual(report['not_run'], CONSUMERS, detail)
        with self.subTest('failing prerequisite retained'):
            self.assertTrue(any(p['classification'] != 'completed'
                                for p in report['prerequisites']), detail)


if __name__ == '__main__':
    unittest.main()
