#!/usr/bin/env python3
"""Original N CF02 paired matrices, bounded and compared without golden rows.

Provenance: docs/research/recursive-join/cf02-evidence.md, N16 matrix pair.
Identity is checked by the native producer before its first output. Captures
are emitted only after both producers and all 33 comparisons succeed.
"""
import json, pathlib, subprocess, sys


def records(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def compare(native, public):
    n = {(r['enc'], r['id']): r for r in native if 'id' in r}
    p = {(r['enc'], r['id']): r for r in public}
    expected = {(enc, f'Q{i}') for enc in ('utf8', 'utf16le', 'utf16be') for i in range(11)}
    assert len([r for r in native if 'id' in r]) == len(public) == 33
    assert n.keys() == p.keys() == expected
    for key, a in n.items():
        b = p[key]
        if 'error' in a:
            assert a['phase'] == b['phase'] == 'prepare', (key, a, b)
            assert a['code'] == b['code'] == 1, (key, a, b)
            assert a['error'] == b['error'], (key, a, b)
        else:
            assert 'error' not in b, (key, a, b)
            assert a['metadata'] == b['metadata'], (key, a, b)
            assert a['runs'] == b['runs'], (key, a, b)


def main():
    root, library, node, output = sys.argv[1:]
    here = pathlib.Path(__file__).resolve().parent
    native = subprocess.run([sys.executable, str(here/'matrix-native.py'), root, library, node],
                            capture_output=True, text=True, timeout=80, check=True)
    public = subprocess.run([node, '--experimental-strip-types', str(here/'matrix.mjs'), '', root],
                            capture_output=True, text=True, timeout=80, check=True)
    compare(records(native.stdout), records(public.stdout))
    target = pathlib.Path(output)
    target.mkdir(parents=True, exist_ok=True)
    (target/'native.json').write_text(native.stdout)
    (target/'public.json').write_text(public.stdout)
    print('CF02 original matrix: 33 typed/metadata/reset/prepare-error pairs match')


if __name__ == '__main__':
    main()
