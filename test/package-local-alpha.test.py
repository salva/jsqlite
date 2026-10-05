#!/usr/bin/env python3
"""Focused scaffold guards; real exact-source pack verification is explicit."""
import pathlib, subprocess, unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class AlphaArguments(unittest.TestCase):
    def reject(self, *args):
        result = subprocess.run(['python3', 'tools/package/local-alpha.py', *args], cwd=ROOT,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 2, result.stderr)

    def test_moving_source_rejected(self):
        self.reject('--commit', 'HEAD', '--version', '0.0.0-alpha.1', '--name', 'alpha-check')

    def test_release_version_rejected(self):
        self.reject('--commit', 'a'*40, '--version', '1.0.0', '--name', 'alpha-check')

    def test_output_escape_rejected(self):
        self.reject('--commit', 'a'*40, '--version', '0.0.0-alpha.1', '--name', '../outside')


if __name__ == '__main__':
    unittest.main()
