#!/usr/bin/env python3
"""Recapture prefix evidence in an invocation-owned root, never in the checkout."""
import argparse
import ctypes
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', required=True, type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    parser.add_argument('--branches', action='store_true')
    args = parser.parse_args()
    root = pathlib.Path.cwd()
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    library = args.library.resolve()
    native = ctypes.CDLL(str(library))
    native.sqlite3_sourceid.restype = ctypes.c_char_p
    native.sqlite3_libversion.restype = ctypes.c_char_p
    assert native.sqlite3_sourceid().decode() == pin['sqliteSourceId']
    assert native.sqlite3_libversion().decode() == pin['version']
    # Refuse reuse; no stale or peer-owned output can satisfy this invocation.
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    for name in ('test/conformance/capture-like-prefix.py',
                 'test/conformance/capture-index-planner.py',
                 'reference/sqlite/manifest.json'):
        target = output/name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root/name, target)
    (output/'test/conformance/cases').mkdir(parents=True)
    command = [sys.executable, str(output/'test/conformance/capture-like-prefix.py'), str(library)]
    if args.branches:
        command.append('--branches')
    subprocess.run(command, check=True)
    suffix = '-branches' if args.branches else ''
    receipt = f'test/conformance/cases/like-prefix{suffix}-native.json'
    actual = json.loads((output/receipt).read_text())
    expected = json.loads((root/receipt).read_text())
    assert actual == expected, 'prefix native corpus mismatch'
    for variant in actual['variants']:
        fixture = variant['fixture']
        for base in (output, root):
            assert hashlib.sha256((base/fixture).read_bytes()).hexdigest() == variant['sha256'], fixture
    print('prefix native receipt and fixtures equal:', receipt)


if __name__ == '__main__':
    main()
