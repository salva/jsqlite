#!/usr/bin/env python3
"""Pinned typed native selected/scan differential for joined equality/IN/range."""
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
scenarios = [
    ('SELECT x.id,x.a,x.b,y.id FROM m x {hint} RIGHT JOIN m y ON x.a=y.a AND x.b=?1 WHERE y.id IN (1,4,5) ORDER BY y.id,x.id', [(1,), (99,), (2,), (None,), (1,)]),
    ('SELECT x.id,y.id,y.c FROM m x LEFT JOIN m y {hint} ON y.a=x.a AND y.b=?1 WHERE x.id IN (1,2,3) ORDER BY x.id,y.id', [(2,), (99,), (1,), (None,), (2,)]),
    ('SELECT x.id,y.id FROM m x JOIN m y {hint} ON y.a=x.a WHERE x.id IN (1,2,3) AND y.b>=?1 ORDER BY x.id,y.id', [(2,), (None,), (1,), (None,), (3,)]),
    ('SELECT id,a FROM m {hint} WHERE a = ?1 ORDER BY a,id', [(1,), (None,), (2,), (None,), (1,)]),
    ('SELECT id,a FROM m {hint} WHERE a IS ?1 ORDER BY a,id', [(1,), (None,), (2,), (None,), (1,)]),
    ('SELECT id,a,b FROM m {hint} WHERE a IN (?1,?2,?3) AND b IN (?4,?5,?6) ORDER BY a,b,id', [(1,1,None,1,3,None),(2,None,1,2,2,None),(None,None,None,1,2,None),(1,2,1,3,1,3)]),
    ('SELECT id,a,b FROM m {hint} WHERE a IN (?1,?2,?3) AND b IN (?4,?5,?6) AND c>=?7 ORDER BY a,b,c,id', [(1,2,None,1,2,None,None),(1,2,None,1,2,None,2),(2,1,2,3,1,None,1)]),
]
for variant in capture['variants']:
    db = P()
    uri = (root / variant['fixture']['path']).resolve().as_uri() + '?immutable=1&mode=ro'
    assert lib.sqlite3_open_v2(uri.encode(), C.byref(db), 0x00000001 | 0x00000040, None) == 0
    try:
        for sql, bindings in scenarios:
            statements = []
            for hint in ('INDEXED BY m_abc', 'NOT INDEXED'):
                stmt = P()
                assert lib.sqlite3_prepare_v2(db, sql.format(hint=hint).encode(), -1, C.byref(stmt), None) == 0, (variant['id'],sql)
                statements.append(stmt)
            try:
                for args in bindings:
                    result = []
                    for stmt in statements:
                        assert lib.sqlite3_reset(stmt) == 0
                        assert lib.sqlite3_clear_bindings(stmt) == 0
                        for slot, value in enumerate(args, 1):
                            assert (lib.sqlite3_bind_null(stmt, slot) if value is None else lib.sqlite3_bind_int64(stmt, slot, value)) == 0
                        rows = []
                        while True:
                            rc = lib.sqlite3_step(stmt)
                            if rc == 101: break
                            assert rc == 100, (variant['id'], sql, rc)
                            rows.append(tuple(None if lib.sqlite3_column_type(stmt, i) == 5 else (lib.sqlite3_column_type(stmt, i), lib.sqlite3_column_int64(stmt, i)) for i in range(lib.sqlite3_column_count(stmt))))
                        result.append(rows)
                    assert result[0] == result[1], (variant['id'],sql,args,result)
                    if args[0] is None and '>=?1' in sql: assert result[0] == [], result
            finally:
                for stmt in statements: assert lib.sqlite3_finalize(stmt) == 0
    finally:
        assert lib.sqlite3_close(db) == 0
print('pinned joined/equality/IN/LEFT/RIGHT typed differential: 3 encodings, 7 scenarios, reset/rebind pass')
