"""CF06 producer/CLI boundary controls; native controls require explicit oracle."""
import copy
import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONSUMER = 'test/conformance/aggregate-module-position.test.mjs'


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/f'tools/test/{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CF06(unittest.TestCase):
    def test_partition_and_packet_rejections(self):
        integration, paired = load('integration'), load('cf06-paired')
        library, work = pathlib.Path('/oracle'), pathlib.Path('/work')
        commands = integration.prerequisite_commands([CONSUMER], library, work)
        self.assertEqual(len(commands), 1)
        self.assertIn('tools/test/cf06-paired.py', commands[0])
        self.assertEqual(integration.prerequisite_commands([], library, work), [])
        siblings = ['test/conformance/'+s+'.test.mjs' for s in
                    ('materialized-cte-linked-consumer', 'recursive-cte-resolution', 'compound-aggregate-destinations')]
        for sibling in siblings:
            alone = integration.prerequisite_commands([sibling], library, work)
            both = integration.prerequisite_commands([CONSUMER, sibling], library, work)
            self.assertEqual(both[1:], alone)
        records = [dict(enc=e, id=i, metadata=[], runs=[[], []])
                   for e in paired.ENCODINGS for i in paired.LABELS]
        paired.compare(records, records)
        for action in ('missing', 'duplicate', 'error', 'reset', 'metadata', 'typed'):
            with self.subTest(action=action):
                bad = copy.deepcopy(records)
                if action == 'missing': bad.pop()
                if action == 'duplicate': bad[-1] = bad[0]
                if action == 'error': bad[0] = dict(enc='utf8', id='J0', error='bad')
                if action == 'reset': bad[0]['runs'][1] = [['changed']]
                if action == 'metadata': bad[0]['metadata'] = [{'name': 'changed'}]
                if action == 'typed': bad[0]['runs'] = [[[['real', 8]]]]*2
                with self.assertRaises((AssertionError, KeyError)):
                    paired.compare(records, bad)

    def test_actual_cli(self):
        library = os.environ.get('INTEGRATION_TEST_ORACLE')
        if not library:
            self.skipTest('INTEGRATION_TEST_ORACLE required')
        node = shutil.which('node')
        for action in ('pass', 'mutate', 'delete', 'failure'):
            with self.subTest(action=action):
                work = pathlib.Path(tempfile.mkdtemp(prefix='cf06-cli-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
                env = dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work), PYTHONDONTWRITEBYTECODE='1')
                if action != 'pass':
                    binary = work/'bin'; binary.mkdir()
                    change = {'mutate': 'p.write_text("{}")', 'delete': 'p.unlink()', 'failure': 'sys.exit(7)'}[action]
                    shim = binary/'node'
                    shim.write_text('#!'+sys.executable+'\nimport os,pathlib,sys\n'
                        +'if "--test" not in sys.argv: os.execv('+repr(node)+',["node",*sys.argv[1:]])\n'
                        +'p=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/"cf06-paired/receipt.json"\n'
                        +change+'\n')
                    shim.chmod(0o755)
                    env['PATH'] = str(binary)+os.pathsep+env['PATH']
                result = subprocess.run([sys.executable, 'tools/test/integration.py', '--oracle-library', library, CONSUMER],
                                        cwd=ROOT, env=env, capture_output=True, text=True, timeout=180)
                (work/'cli.stdout').write_text(result.stdout)
                (work/'cli.stderr').write_text(result.stderr)
                report = json.loads((work/'integration-run/manifest.json').read_text())
                self.assertEqual([p['exit'] for p in report['prerequisites']], [0], str(work))
                self.assertEqual(result.returncode, 0 if action == 'pass' else 1, str(work))
                self.assertEqual(report['not_run'], [])
                self.assertEqual(report['input_drift'], [str(work/'cf06-paired/receipt.json')] if action in ('mutate', 'delete') else [])
                self.assertEqual(report['results'][0]['exit'], 7 if action == 'failure' else 0)
                self.assertEqual(set(report['generated_inputs']), {'cf06-paired/'+n for n in ('native.json', 'public.json', 'receipt.json')})
        # Actual producer pin rejection before public execution or any receipt.
        for field in ('version', 'sqliteSourceId'):
            work = pathlib.Path(tempfile.mkdtemp(prefix='cf06-pin-', dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
            pin = work/'reference/sqlite/manifest.json'; pin.parent.mkdir(parents=True)
            data = json.loads((ROOT/'reference/sqlite/manifest.json').read_text()); data[field] = 'wrong-pin'
            pin.write_text(json.dumps(data))
            # Minimal ordinary Git checkout: pin rejection happens before any
            # fixture or public import, through the actual CLI prerequisite.
            for name in ('tools/test/integration.py', 'tools/test/cf06-paired.py',
                         'tools/test/cf06-native.py', 'tools/test/cf06-paired.mjs',
                         'tools/test/cf06-cases.json', CONSUMER):
                target = work/name; target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT/name, target)
            subprocess.run(['git', 'init', '-q'], cwd=work, check=True)
            subprocess.run(['git', '-c', 'user.name=Harness', '-c', 'user.email=harness@example.invalid',
                            'commit', '--allow-empty', '-qm', 'pin control'], cwd=work, check=True)
            env = dict(os.environ, SAIVAGE_CARD_WORK_ROOT=str(work/'run'), PYTHONDONTWRITEBYTECODE='1')
            result = subprocess.run([sys.executable, 'tools/test/integration.py', '--oracle-library', library, CONSUMER],
                                    cwd=work, env=env, capture_output=True, text=True, timeout=180)
            report = json.loads((work/'run/integration-run/manifest.json').read_text())
            self.assertEqual(result.returncode, 1)
            self.assertEqual(report['not_run'], [CONSUMER])
            self.assertEqual(report['results'], [])
            self.assertEqual(report['prerequisites'][0]['classification'], 'fail')
            self.assertIn('AssertionError', pathlib.Path(report['prerequisites'][0]['log']).read_text())
            self.assertFalse((work/'run/cf06-paired/receipt.json').exists())


if __name__ == '__main__':
    unittest.main()
