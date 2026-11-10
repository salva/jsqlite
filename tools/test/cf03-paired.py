#!/usr/bin/env python3
"""Pair the unchanged original CF03 witness with the public API.

The original producer owns SQL, pin, metadata, two native reset assertions and
error codes. Its AST literal is read, not copied into a second SQL inventory.
"""
import ast
import json
import pathlib
import subprocess
import sys


def cases(root):
    tree = ast.parse((root/'docs/research/cf03-cte-native.py').read_text())
    return next(ast.literal_eval(n.value) for n in tree.body
                if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'cases' for t in n.targets))


def compare(native, public):
    expected = {(e, label) for e in ('utf8', 'utf16le', 'utf16be') for label in
                ('having0', 'having1', 'stop', 'offset', 'zero', 'aggregate', 'origin', 'error')}
    n = {(r[0], r[1]): r for r in native}
    p = {(r['enc'], r['label']): r for r in public}
    assert len(native) == len(public) == 24 and n.keys() == p.keys() == expected
    for key, (_, _, metadata, rows, code) in n.items():
        actual = p[key]
        assert actual['metadata'] == metadata, (key, metadata, actual)
        want = [['null', None] if v is None else ['integer', str(v)] for v in rows]
        assert len(actual['runs']) == 2, (key, actual)
        for run in actual['runs']:
            assert run['rows'] == want and run['code'] == code, (key, want, code, run)
            if code == 1:
                assert run['phase'] == 'step' and run['kind'] == 'sqlite' and run['error'] == 'malformed JSON', (key, run)


def main():
    root, library, node, output = sys.argv[1:]
    root = pathlib.Path(root).resolve()
    source = root/'docs/research/cf03-cte-native.py'
    native = subprocess.run([sys.executable, str(source), str(root), library],
                            capture_output=True, text=True, timeout=80, check=True)
    public = subprocess.run([node, '--experimental-strip-types',
                             str(pathlib.Path(__file__).with_suffix('.mjs')), str(root)],
                            input=json.dumps(cases(root)), capture_output=True, text=True, timeout=80, check=True)
    compare([json.loads(s) for s in native.stdout.splitlines()],
            [json.loads(s) for s in public.stdout.splitlines()])
    target = pathlib.Path(output)
    target.mkdir(parents=True, exist_ok=True)
    (target/'native.json').write_text(native.stdout)
    (target/'public.json').write_text(public.stdout)
    print('CF03 original witness: 24 metadata/typed/two-reset/error pairs match')


if __name__ == '__main__':
    main()
