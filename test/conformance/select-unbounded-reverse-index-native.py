#!/usr/bin/env python3
"""Pinned SQLite read-only oracle for the unbounded reverse selected-index boundary."""
import ctypes as C
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'reference/sqlite/manifest.json').read_text())
capture = json.loads((root / 'test/conformance/cases/stage3-advanced-index.json').read_text())
lib = C.CDLL(sys.argv[1])
P = C.c_void_p
for name, args, result in [
    ('sqlite3_sourceid', [], C.c_char_p),
    ('sqlite3_open_v2', [C.c_char_p, C.POINTER(P), C.c_int, C.c_char_p], C.c_int),
    ('sqlite3_prepare_v2', [P, C.c_char_p, C.c_int, C.POINTER(P), C.POINTER(C.c_char_p)], C.c_int),
    ('sqlite3_step', [P], C.c_int),
    ('sqlite3_column_count', [P], C.c_int),
    ('sqlite3_column_type', [P, C.c_int], C.c_int),
    ('sqlite3_column_int64', [P, C.c_int], C.c_longlong),
    ('sqlite3_reset', [P], C.c_int),
    ('sqlite3_finalize', [P], C.c_int),
    ('sqlite3_close', [P], C.c_int),
]:
    f = getattr(lib, name)
    f.argtypes = args
    f.restype = result
assert lib.sqlite3_sourceid().decode() == manifest['sqliteSourceId'] == capture['source']['sourceId']
expected = [[(1, 5), (1, 3), (1, 3)], [(1, 4), (1, 2), (1, 2)],
            [(1, 3), (1, 1), (1, 3)], [(1, 2), (1, 1), (1, 2)],
            [(1, 1), (1, 1), (1, 1)]]
for variant in capture['variants']:
    db = P()
    uri = (root / variant['fixture']['path']).resolve().as_uri() + '?immutable=1&mode=ro'
    assert lib.sqlite3_open_v2(uri.encode(), C.byref(db), 0x00000001 | 0x00000040, None) == 0
    try:
        for hint in ('INDEXED BY m_abc', 'NOT INDEXED'):
            sql = f'SELECT id,a,b FROM m {hint} ORDER BY a DESC,b DESC,c DESC,id DESC'
            stmt = P()
            assert lib.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(stmt), None) == 0
            try:
                assert lib.sqlite3_column_count(stmt) == 3
                for _ in range(2):
                    rows = []
                    while True:
                        rc = lib.sqlite3_step(stmt)
                        if rc == 101:
                            break
                        assert rc == 100, (variant['id'], hint, rc)
                        rows.append([(lib.sqlite3_column_type(stmt, i), lib.sqlite3_column_int64(stmt, i)) for i in range(3)])
                    assert rows == expected, (variant['id'], hint, rows)
                    assert lib.sqlite3_reset(stmt) == 0
            finally:
                assert lib.sqlite3_finalize(stmt) == 0
    finally:
        assert lib.sqlite3_close(db) == 0
print('pinned reverse index and scan typed rows: 3 encodings, 2 resets, pass')
