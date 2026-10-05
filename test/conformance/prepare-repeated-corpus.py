#!/usr/bin/env python3
"""Reproduce frozen bytes in a disposable clean Git export, never the workspace."""
import argparse, hashlib, json, os, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument('--library', required=True)
a = ap.parse_args()
work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']).resolve()
# Deletion is permitted only in an explicitly named, disposable export child.
if root.name != 'repeated-clean-export' or not root.is_relative_to(work) or (root / '.git').exists():
    raise SystemExit('requires disposable repeated-clean-export under card work root')
paths = [f'cases/{n}.json' for n in ['repeated-right-full', 'repeated-upstream-join8', 'repeated-upstream-join8-utf16']]
paths += [f'fixtures/repeated-right-full-{e}.db' for e in ['utf8','utf16le','utf16be']]
paths += ['fixtures/repeated-upstream-join8.db']
paths += [f'fixtures/repeated-upstream-join8-{e}.db' for e in ['utf16le','utf16be']]
legacy = work / 'oracle-build/build/libsqlite3-oracle.so'
if pathlib.Path(a.library).resolve() != legacy.resolve():
    raise SystemExit('library must be the card oracle-build library')
base = root / 'test/conformance'
expected = {p: hashlib.sha256((base / p).read_bytes()).hexdigest() for p in paths}
for p in paths:
    (base / p).unlink()
env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
# Legacy UTF8/16 entrypoints use this library location; keep their CLI stable.
for script, args in [('capture-repeated-right-full.py', ['--library', a.library]),
                     ('capture-repeated-upstream.py', []),
                     ('capture-repeated-upstream-utf16.py', []),
                     ('verify-repeated-upstream.py', [])]:
    subprocess.run(['python3', str(base / script), *args], env=env, check=True)
for p, digest in expected.items():
    if hashlib.sha256((base / p).read_bytes()).hexdigest() != digest:
        raise SystemExit(f'frozen output mismatch: {p}')
print(json.dumps({'frozenOutputs':expected,'result':'9/9 byte-identical regenerated outputs'},indent=2))
