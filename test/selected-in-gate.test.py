"""Fixture ownership regression: keep the historical failing inventory intact."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('gate', 'tools/test/selected-in-gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class SelectedInGate(unittest.TestCase):
    def test_distinct_fixture_owners(self):
        env = gate.fixture_environment(pathlib.Path('/captures'), pathlib.Path('/run'))
        self.assertEqual(env['SELECT_IN_NATIVE_DIR'], '/captures/select-in-affinity-native')
        self.assertEqual(env['SELECT_IN_PERSISTENT_CORRUPTION_DIR'], '/run/persistent-corruption')
        self.assertNotEqual(env['SELECT_IN_PERSISTENT_CORRUPTION_DIR'], env['SELECT_IN_CORRUPTION_DIR'])
        self.assertEqual(env['SELECT_IN_VECTOR_DIR'], '/captures/vector-red')
        self.assertEqual(env['SELECT_IN_VECTOR_PREFIX_DIR'], '/captures/vector-prefix-red')

    def test_all_three_encoding_wrappers_mandatory(self):
        self.assertEqual(len(gate.EXTRA_FILES), len(set(gate.EXTRA_FILES)))
        for name in ['correlated-in-work.test.mjs', 'correlated-in-work-utf16le.test.mjs',
                     'correlated-in-work-utf16be.test.mjs']:
            self.assertIn(name, gate.EXTRA_FILES)


if __name__ == '__main__':
    unittest.main()
