#!/usr/bin/env python3
"""Pinned public controls for the materialized-window predicate binding phase."""
import ctypes as C
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
lib = C.CDLL(sys.argv[1])
P = C.c_void_p
for name, args, result in [
    ('sqlite3_sourceid', [], C.c_char_p),
    ('sqlite3_open_v2', [C.c_char_p, C.POINTER(P), C.c_int, C.c_char_p], C.c_int),
    ('sqlite3_prepare_v2', [P, C.c_char_p, C.c_int, C.POINTER(P), C.POINTER(C.c_char_p)], C.c_int),
    ('sqlite3_step', [P], C.c_int), ('sqlite3_column_type', [P, C.c_int], C.c_int),
    ('sqlite3_column_int64', [P, C.c_int], C.c_longlong),
    ('sqlite3_reset', [P], C.c_int), ('sqlite3_finalize', [P], C.c_int),
    ('sqlite3_close', [P], C.c_int),
]:
    fn = getattr(lib, name)
    fn.argtypes, fn.restype = args, result
assert lib.sqlite3_sourceid().decode() == json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name', 'decltype', 'database_name', 'table_name', 'origin_name']:
    fn = getattr(lib, 'sqlite3_column_' + name)
    fn.argtypes, fn.restype = [P, C.c_int], C.c_char_p
current = json.loads((root/'test/fixtures/CURRENT.json').read_text())
for encoding in ['utf8', 'utf16le', 'utf16be']:
    db = P()
    fixture = root/'test/fixtures/generations'/current['generationId']/f'generated/subquery-{encoding}.db'
    assert lib.sqlite3_open_v2(str(fixture).encode(), C.byref(db), 1, None) == 0
    try:
        for predicate, expected in [('d.r BETWEEN 2 AND 3', [3, 2]), ('d.r IN (2,4)', [4, 2]), ('CASE WHEN d.r=1 THEN NULL ELSE d.r END > 2', [4, 3]), ('alias', [4,3,2,1]), ('ordinal', [4,3,2,1]), ('qualified-star', [4,3,2,1])]:
            sql = f'SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE {predicate} ORDER BY d.r DESC'
            controls = {
                'alias': ('SELECT d.r AS renamed FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY renamed DESC', b'renamed'),
                'ordinal': ('SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY 1 DESC', b'r'),
                'qualified-star': ('SELECT d.* FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r DESC', b'r'),
            }
            sql, output_name = controls.get(predicate, (sql, b'r'))
            stmt, tail = P(), C.c_char_p()
            assert lib.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(stmt), C.byref(tail)) == 0
            try:
                metadata = [getattr(lib, 'sqlite3_column_' + name)(stmt, 0) for name in ['name', 'decltype', 'database_name', 'table_name', 'origin_name']]
                assert metadata == [output_name, None, None, None, None], metadata
                for cycle in range(2):
                    rows = []
                    while True:
                        rc = lib.sqlite3_step(stmt)
                        if rc == 101:
                            break
                        assert rc == 100 and lib.sqlite3_column_type(stmt, 0) == 1, rc
                        rows.append(lib.sqlite3_column_int64(stmt, 0))
                    assert rows == expected, (sql, rows)
                    if cycle == 0:
                        assert lib.sqlite3_reset(stmt) == 0
                print(encoding, predicate, expected, 'INTEGER; metadata; DONE/reset PASS')
            finally:
                assert lib.sqlite3_finalize(stmt) == 0
    finally:
        assert lib.sqlite3_close(db) == 0
