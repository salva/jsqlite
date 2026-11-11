#!/usr/bin/env python3
"""Relocated l-e J0-J3 packet (status18): independent native/public comparison.

Preserves original SQL, typed cells, five-field metadata and two reset drains.
CF06 checks pinned version/SourceID and records actual bytes; CF03's distinct
executable qualification policy is unchanged. No native answers reach public.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

ENCODINGS = ('utf8', 'utf16le', 'utf16be')
LABELS = ('J0', 'J1', 'J2', 'J3')


def compare(native, public):
    expected = {(e, label) for e in ENCODINGS for label in LABELS}
    def index(records):
        assert len(records) == 12, 'CF06 requires exactly twelve records'
        result = {(r['enc'], r['id']): r for r in records}
        assert result.keys() == expected, 'CF06 case membership mismatch'
        for r in records:
            assert set(r) == {'enc', 'id', 'metadata', 'runs'}, ('CF06 error/incomplete record', r)
            assert len(r['runs']) == 2 and r['runs'][0] == r['runs'][1], 'CF06 reset mismatch'
        return result
    assert index(native) == index(public), 'CF06 typed/metadata/reset mismatch'


def main():
    root, library, node, output = sys.argv[1:]
    root, library = pathlib.Path(root).resolve(), pathlib.Path(library).resolve()
    here = pathlib.Path(__file__).parent.resolve()
    cases = (here/'cf06-cases.json').read_text()
    assert [c[0] for c in json.loads(cases)] == list(LABELS)
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    before_library = digest(library)
    try:
        native = subprocess.run([sys.executable, str(here/'cf06-native.py'), str(root), str(library)],
                                input=cases, capture_output=True, text=True, timeout=80, check=True)
    except subprocess.CalledProcessError as error:
        sys.stderr.write(error.stderr)
        raise
    records = [json.loads(s) for s in native.stdout.splitlines()]
    profile = records[0]
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    assert profile == dict(version=pin['version'], sourceId=pin['sqliteSourceId'], librarySha256=before_library)
    rows = [r for r in records if 'id' in r]
    compare(rows, rows)  # Reject errors/duplicates/missing cases before public execution.
    public = subprocess.run([node, '--experimental-strip-types', str(here/'cf06-paired.mjs'), str(root)],
                            input=cases, capture_output=True, text=True, timeout=80, check=True)
    compare(rows, [json.loads(s) for s in public.stdout.splitlines()])
    assert digest(library) == before_library, 'oracle changed during CF06 capture'
    target = pathlib.Path(output)
    target.mkdir(parents=True, exist_ok=False)
    (target/'native.json').write_text(native.stdout)
    (target/'public.json').write_text(public.stdout)
    generation = json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
    inputs = [here/name for name in ('cf06-native.py', 'cf06-paired.py', 'cf06-paired.mjs', 'cf06-cases.json')]
    inputs += [root/'reference/sqlite/manifest.json', root/'test/fixtures/CURRENT.json']
    inputs += [root/f'test/fixtures/generations/{generation}/generated/subquery-{e}.db' for e in ENCODINGS]
    receipt = dict(profile=profile, pairs=12, cycles=2,
                   inputs={str(p.relative_to(root)): digest(p) for p in inputs},
                   captures={name: digest(target/name) for name in ('native.json', 'public.json')})
    (target/'receipt.json').write_text(json.dumps(receipt, indent=2, sort_keys=True)+'\n')
    print('CF06 J0-J3: 12 typed/full-metadata/two-reset pairs match')


if __name__ == '__main__':
    main()
