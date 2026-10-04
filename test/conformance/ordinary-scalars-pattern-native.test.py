#!/usr/bin/env python3
"""Pinned native physical-fixture infix caller discriminators."""
import argparse
import ctypes as C
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = json.loads((ROOT / "test/conformance/cases/stage3-ordinary-scalars.spec.json").read_text())
P = C.c_void_p
ap = argparse.ArgumentParser()
ap.add_argument("--library", required=True)
ns = ap.parse_args()
L = C.CDLL(ns.library)
for name, args, result in (
    ("sqlite3_sourceid", [], C.c_char_p),
    ("sqlite3_open", [C.c_char_p, C.POINTER(P)], C.c_int),
    ("sqlite3_prepare_v2", [P, C.c_char_p, C.c_int, C.POINTER(P), C.POINTER(C.c_char_p)], C.c_int),
    ("sqlite3_step", [P], C.c_int),
    ("sqlite3_column_count", [P], C.c_int),
    ("sqlite3_column_text", [P, C.c_int], P),
    ("sqlite3_column_bytes", [P, C.c_int], C.c_int),
    ("sqlite3_finalize", [P], C.c_int),
    ("sqlite3_close", [P], C.c_int),
):
    f = getattr(L, name)
    f.argtypes = args
    f.restype = result
assert L.sqlite3_sourceid().decode() == SPEC["source"]["sourceId"]

def execute(db, sql):
    statement, tail = P(), C.c_char_p()
    assert L.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(statement), C.byref(tail)) == 0
    try:
        assert L.sqlite3_step(statement) == 100
        values = []
        for i in range(L.sqlite3_column_count(statement)):
            assert L.sqlite3_column_type(statement, i) == 1
            value = L.sqlite3_column_text(statement, i)
            values.append(C.string_at(value, L.sqlite3_column_bytes(statement, i)).decode())
        return values
    finally:
        assert L.sqlite3_finalize(statement) == 0

L.sqlite3_column_type.argtypes = [P, C.c_int]
L.sqlite3_column_type.restype = C.c_int
cases = [("SELECT name LIKE '%a%' FROM users WHERE id=1", ['1']), ("SELECT name LIKE '%a%' FROM users WHERE id=2", ['0']), ("SELECT name LIKE '%a%' FROM users WHERE id=3", ['1']), ('SELECT count(*) FROM users', ['3']), ("SELECT count(*) FROM users WHERE name LIKE '%a%'", ['2']), ("SELECT count(*) FROM users WHERE like('%a%',name)", ['2']), ("SELECT sum(name LIKE '%a%') FROM users", ['2']), ("SELECT count(*) FROM users WHERE name NOT LIKE '%a%'", ['1']), ("SELECT count(*) FROM users WHERE name GLOB '*a*'", ['1']), ("SELECT count(*) FROM users WHERE name NOT GLOB '*a*'", ['2']), ("SELECT count(*) FROM users WHERE name LIKE '!%a!%' ESCAPE '!'", ['0']), ("SELECT u.name NOT GLOB 'B*' FROM users u JOIN users v ON u.id=v.id WHERE v.id=1", ['1'])]
for encoding, fixture in SPEC['scope']['publicFetchFixtures'].items():
    db = P()
    assert L.sqlite3_open(str(ROOT / fixture).encode(), C.byref(db)) == 0
    try:
        for sql, expected in cases:
            assert execute(db, sql) == expected, (encoding, sql)
    finally:
        assert L.sqlite3_close(db) == 0
print(json.dumps({'outcome':'pass','encodings':3,'integerCallerChecks':len(cases)*3}))
