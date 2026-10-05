#!/usr/bin/env python3
"""Verify STAT4 fixture query portability using pinned native without STAT4.
Development-only: no fixture writes, no native runtime shipping, no EQP credit.
"""
import argparse
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('library')
    args = p.parse_args()
    spec = importlib.util.spec_from_file_location('native', ROOT/'test/conformance/capture-index-planner.py')
    native = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(native)
    d = native.load(args.library)
    pin = json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
    assert d.sqlite3_sourceid().decode() == pin['sqliteSourceId']
    assert d.sqlite3_libversion().decode() == pin['version']
    d.sqlite3_compileoption_used.argtypes = [C.c_char_p]
    assert d.sqlite3_compileoption_used(b'ENABLE_STAT4') == 0, 'requires non-STAT4 native comparison'
    capture = json.loads((ROOT/'test/conformance/cases/stat4-enabled-boundary.json').read_text())
    assert capture['sourceId'] == pin['sqliteSourceId']
    results = []
    for variant in capture['variants']:
        path = ROOT/variant['fixture']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == variant['sha256']
        db = C.c_void_p()
        assert d.sqlite3_open_v2(str(path).encode(), C.byref(db), native.SQLITE_OPEN_READONLY, None) == native.OK
        try:
            samples, _ = native.query(d, db, 'SELECT count(*) FROM sqlite_stat4')
            assert samples == [[variant['samples']]]
            for id, sql in capture['sql'].items():
                for attempt in range(2):
                    rows, _ = native.query(d, db, sql)
                    assert rows == variant['cases'][id]['rows'], (variant['encoding'], id, attempt)
                results.append({'encoding': variant['encoding'], 'query': id,
                                'typedRowsMatch': True, 'repeatExecutions': 2,
                                'fixtureSha256': variant['sha256']})
        finally:
            assert d.sqlite3_close(db) == native.OK
    print(json.dumps({'sourceId': pin['sqliteSourceId'], 'enableStat4': False,
                      'librarySha256': hashlib.sha256(pathlib.Path(args.library).read_bytes()).hexdigest(),
                      'results': results}, indent=2))


if __name__ == '__main__':
    main()
