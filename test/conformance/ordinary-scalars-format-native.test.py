#!/usr/bin/env python3
"""Pinned native discriminators for SQL-accessible printf.c correction branches."""
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
            value = L.sqlite3_column_text(statement, i)
            values.append(C.string_at(value, L.sqlite3_column_bytes(statement, i)).decode())
        return values
    finally:
        assert L.sqlite3_finalize(statement) == 0

db = P()
assert L.sqlite3_open(b":memory:", C.byref(db)) == 0
try:
    cases = [
        ("SELECT printf('%r|%,d|abc%',1,1234567)", ["1st|1,234,567|abc%"]),
        ("SELECT printf('[%5s][%!5s]','é','é'),printf('[%.*s]',-2,'abcd')", ["[   é][    é]", "[ab]"]),
        ("SELECT printf('%f|%0.2e|%+f|% f',1e999,1e999,-1e999,1e999)", ["Inf|9.00e+999|-Inf| Inf"]),
        ("""SELECT printf('%.999s','x'),printf('%.*s',999,''),printf('%.999q','a''b'),printf('%.*Q',999,'x'),printf('%.999w','a"b'),printf('%.2c','é')""", ["x", "", "a''b", "'x'", 'a""b', "éé"]),
        ("SELECT printf('%999n'),printf('%*n',999),printf('a%999nb'),printf('%*n%d',999,7)", ["", "", "ab", "7"]),
        ("SELECT CAST(9223372036854775807+1 AS TEXT),CAST(1e308*10 AS TEXT),CAST(1e-320 AS TEXT),printf('%!.17g|%!.20g',1e-320,1e-320),quote(1e308*10)", ["9.2233720368547758e+18", "Inf", "9.9998886718268301e-321", "9.9998886718268301e-321|9.99988867182683005e-321", "9.0e+999"]),
        ("SELECT printf('%!.20f',1.0/3),printf('%!.20F',-1.0/3),printf('%!.20e',1e-320),printf('%!+030.20E',-1e20/3)", ["0.333333333333333315", "", "9.99988867182683005e-321", "-00000003.3333333333333332E+19"]),
    ]
    for sql, expected in cases:
        assert execute(db, sql) == expected
finally:
    assert L.sqlite3_close(db) == 0
print(json.dumps({"outcome": "pass", "nativeFormatterDiscriminators": len(cases)}))
