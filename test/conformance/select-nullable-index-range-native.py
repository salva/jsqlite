#!/usr/bin/env python3
"""Source-ID-checked SQLite oracle for nullable selected Case 4 range starts."""
import ctypes as C
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / 'reference/sqlite/manifest.json').read_text())
capture = json.loads((root / 'test/conformance/cases/stage3-advanced-index.json').read_text())
lib = C.CDLL(sys.argv[1]); P = C.c_void_p
for name, args, result in [
    ('sqlite3_sourceid', [], C.c_char_p),
    ('sqlite3_open_v2', [C.c_char_p, C.POINTER(P), C.c_int, C.c_char_p], C.c_int),
    ('sqlite3_prepare_v2', [P, C.c_char_p, C.c_int, C.POINTER(P), C.POINTER(C.c_char_p)], C.c_int),
    ('sqlite3_bind_int64', [P, C.c_int, C.c_longlong], C.c_int),
    ('sqlite3_bind_null', [P, C.c_int], C.c_int),
    ('sqlite3_clear_bindings', [P], C.c_int),
    ('sqlite3_step', [P], C.c_int),
    ('sqlite3_column_count', [P], C.c_int),
    ('sqlite3_column_type', [P, C.c_int], C.c_int),
    ('sqlite3_column_int64', [P, C.c_int], C.c_longlong),
    ('sqlite3_reset', [P], C.c_int),
    ('sqlite3_finalize', [P], C.c_int),
    ('sqlite3_close', [P], C.c_int),
]:
    f = getattr(lib, name); f.argtypes = args; f.restype = result
assert lib.sqlite3_sourceid().decode() == manifest['sqliteSourceId'] == capture['source']['sourceId']
for variant in capture['variants']:
    db = P()
    uri = (root / variant['fixture']['path']).resolve().as_uri() + '?immutable=1&mode=ro'
    assert lib.sqlite3_open_v2(uri.encode(), C.byref(db), 0x00000001 | 0x00000040, None) == 0
    try:
        for condition, order, values in [
            ('a=?1 AND b>=?2', 'b,id', [(1, 2), (1, None), (1, 1), (None, 2), (1, 2)]),
            ('a=?1 AND b<=?2', 'b DESC,id DESC', [(1, 3), (1, None), (1, 2), (None, 3), (1, 3)]),
        ]:
            statements = []
            for hint in ('INDEXED BY m_abc', 'NOT INDEXED'):
                sql = f'SELECT id,b FROM m {hint} WHERE {condition} ORDER BY {order}'
                stmt = P()
                assert lib.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(stmt), None) == 0
                statements.append(stmt)
            try:
                for a, b in values:
                    result = []
                    for stmt in statements:
                        assert lib.sqlite3_reset(stmt) == 0
                        assert lib.sqlite3_clear_bindings(stmt) == 0
                        for slot, value in [(1, a), (2, b)]:
                            assert (lib.sqlite3_bind_null(stmt, slot) if value is None else lib.sqlite3_bind_int64(stmt, slot, value)) == 0
                        rows = []
                        assert lib.sqlite3_column_count(stmt) == 2
                        while True:
                            rc = lib.sqlite3_step(stmt)
                            if rc == 101: break
                            assert rc == 100, (variant['id'], condition, rc)
                            rows.append([(lib.sqlite3_column_type(stmt, i), lib.sqlite3_column_int64(stmt, i)) for i in range(2)])
                        result.append(rows)
                    assert result[0] == result[1], (variant['id'], condition, a, b, result)
                    if a is None or b is None: assert result[0] == [], result
                    elif a == 1 and b == 2: assert len(result[0]) >= 2, result
            finally:
                for stmt in statements: assert lib.sqlite3_finalize(stmt) == 0
    finally:
        assert lib.sqlite3_close(db) == 0
print('pinned nullable selected range typed rows: 3 encodings, two directions, 5 rebinds, pass')
