#!/usr/bin/env python3
"""Replay exact original107 plus mandatory selected-IN regressions, without skips."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess

EXTRA_FILES = [
    'selected-correlated-in.test.mjs', 'selected-vector-in.test.mjs',
    'selected-in-r1-matrix.test.mjs', 'selected-correlated-in-lifecycle.test.mjs',
    'correlated-in-corruption.test.mjs', 'derived-selected-in.test.mjs',
    'correlated-in-work.test.mjs', 'correlated-in-work-utf16le.test.mjs',
    'correlated-in-work-utf16be.test.mjs', 'retained-limit-selected-in.test.mjs',
    'grouped-selected-in.test.mjs',
]


def fixture_environment(root, work):
    # The cumulative affinity capture includes composition and NULL-prefix cases.
    # The earlier metadata-only capture is insufficient for this inventory.
    return {key: str(root / value) for key, value in {
        'SELECT_IN_NATIVE_DIR': 'select-in-affinity-native',
        'SELECT_IN_EARLYOUT_DIR': 'select-in-earlyout-native',
        'SELECT_IN_CORRUPTION_DIR': 'select-in-corruption-native',
        'SELECT_IN_REUSE_DIR': 'direct-reuse-native',
        'SELECT_IN_REUSE_MATRIX_DIR': 'direct-reuse-matrix-fixed',
        'SELECT_IN_VECTOR_DIR': 'vector-red',
        'SELECT_IN_VECTOR_PREFIX_DIR': 'vector-prefix-red',
        'SELECT_IN_CORRELATED_DIR': 'correlated-red',
        'SELECT_IN_R1_MATRIX_DIR': 'r1-red-matrix',
        'CORRELATED_IN_CORRUPTION_DIR': 'correlated-corruption',
        'DERIVED_SELECTED_IN_DIR': 'derived-nested-current',
        'RETAINED_LIMIT_SELECTED_IN_DIR': 'retained-limit-native',
        'GROUPED_SELECTED_IN_DIR': 'grouped-native',
        'CORRELATED_IN_WORK_DIR': 'correlated-work',
    }.items()} | {'SELECT_IN_PERSISTENT_CORRUPTION_DIR': str(work / 'persistent-corruption')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture-root', type=pathlib.Path, required=True)
    parser.add_argument('--original-manifest', type=pathlib.Path, required=True)
    parser.add_argument('--oracle-library', type=pathlib.Path, required=True)
    args = parser.parse_args()
    root = args.fixture_root.resolve()
    work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']).resolve()
    work.mkdir(parents=True, exist_ok=True)
    original = json.loads(args.original_manifest.read_text())['files']
    if len(original) != 107 or len(set(original)) != 107:
        parser.error('requires the retained original107 manifest')
    files = original + [f'test/conformance/{f}' for f in EXTRA_FILES
                        if f'test/conformance/{f}' not in original]
    fixtures = fixture_environment(root, work)
    env = dict(os.environ, **fixtures)
    (work / 'inventory.json').write_text(json.dumps(files, indent=2) + '\n')
    (work / 'fixture-environment.json').write_text(json.dumps(fixtures, indent=2) + '\n')
    # Persistent physical-index corruption has a different schema/fixture owner
    # from scalar ephemeral-set corruption. Never interchange their receipts.
    subprocess.run([
        'python3', 'test/conformance/capture-select-in-persistent-corruption.py',
        str(args.oracle_library.resolve()), fixtures['SELECT_IN_REUSE_MATRIX_DIR'],
        fixtures['SELECT_IN_PERSISTENT_CORRUPTION_DIR'],
    ], check=True, env=env)
    inputs = {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
              for directory in set(fixtures.values())
              for p in pathlib.Path(directory).iterdir() if p.is_file()}
    (work / 'fixture-inputs.json').write_text(json.dumps(inputs, indent=2) + '\n')
    result = subprocess.run([
        'python3', 'tools/test/integration.py', '--jobs', '1', '--batch-size', '80',
        '--batch-seconds', '600', '--watchdog-seconds', '100',
        '--oracle-library', str(args.oracle_library.resolve()), *files,
    ], env=env)
    drift = [p for p, digest in inputs.items()
             if not pathlib.Path(p).is_file()
             or hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() != digest]
    (work / 'fixture-drift.json').write_text(json.dumps(drift, indent=2) + '\n')
    return result.returncode or int(bool(drift))


if __name__ == '__main__':
    raise SystemExit(main())
