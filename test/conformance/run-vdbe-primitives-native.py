#!/usr/bin/env python3
"""Verify the bounded VDBE primitive upstream cases with the pinned native oracle."""
import ctypes as C
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[2]
cases = json.loads((root / "test/conformance/cases/stage3-vdbe-primitives.json").read_text())
lib = C.CDLL(sys.argv[1])
P = C.c_void_p
lib.sqlite3_open.argtypes = [C.c_char_p, C.POINTER(P)]
lib.sqlite3_prepare_v2.argtypes = [P, C.c_char_p, C.c_int, C.POINTER(P), C.POINTER(C.c_char_p)]
lib.sqlite3_step.argtypes = [P]
lib.sqlite3_column_type.argtypes = [P, C.c_int]
lib.sqlite3_column_int64.argtypes = [P, C.c_int]
lib.sqlite3_column_int64.restype = C.c_longlong
lib.sqlite3_column_double.argtypes = [P, C.c_int]
lib.sqlite3_column_double.restype = C.c_double
lib.sqlite3_finalize.argtypes = [P]
lib.sqlite3_close.argtypes = [P]

db = P()
assert lib.sqlite3_open(b":memory:", C.byref(db)) == 0
seen = []
try:
    for case in cases["upstreamCases"]:
        stmt = P()
        tail = C.c_char_p()
        assert lib.sqlite3_prepare_v2(db, case["sql"].encode(), -1, C.byref(stmt), C.byref(tail)) == 0, case["ref"]
        assert lib.sqlite3_step(stmt) == 100, case["ref"]
        got = []
        for i, expected in enumerate(case["expected"]):
            kind = lib.sqlite3_column_type(stmt, i)
            if kind == 1:
                got.append({"type": "integer", "value": str(lib.sqlite3_column_int64(stmt, i))})
            elif kind == 2:
                got.append({"type": "real", "value": lib.sqlite3_column_double(stmt, i)})
            elif kind == 5:
                got.append({"type": "null"})
            else:
                raise AssertionError(f"{case['ref']}: unexpected SQLite type {kind}")
        assert got == case["expected"], f"{case['ref']}: {got!r} != {case['expected']!r}"
        seen.append(case["ref"])
        assert lib.sqlite3_finalize(stmt) == 0
finally:
    assert lib.sqlite3_close(db) == 0
print(json.dumps({"sourceId": cases["sourceId"], "passed": len(seen), "refs": seen}, separators=(",", ":")))
