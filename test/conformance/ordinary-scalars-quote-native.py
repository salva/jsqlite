#!/usr/bin/env python3
"""Pinned SQLite quote(REAL) exact-output oracle; grants no TypeScript credit."""
import ctypes
import json
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
pin = json.loads((ROOT / "reference/sqlite/manifest.json").read_text())
lib = ctypes.CDLL(sys.argv[1])
lib.sqlite3_sourceid.restype = ctypes.c_char_p
if lib.sqlite3_sourceid().decode() != pin["sqliteSourceId"]:
    raise SystemExit("native library source identity does not match pinned manifest")
DB, STMT = ctypes.c_void_p, ctypes.c_void_p
lib.sqlite3_open.argtypes = [ctypes.c_char_p, ctypes.POINTER(DB)]
lib.sqlite3_prepare_v2.argtypes = [DB, ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(STMT), ctypes.c_void_p]
lib.sqlite3_bind_double.argtypes = [STMT, ctypes.c_int, ctypes.c_double]
lib.sqlite3_step.argtypes = [STMT]
lib.sqlite3_reset.argtypes = [STMT]
lib.sqlite3_column_text.argtypes = [STMT, ctypes.c_int]
lib.sqlite3_column_text.restype = ctypes.c_char_p
lib.sqlite3_finalize.argtypes = [STMT]
lib.sqlite3_close.argtypes = [DB]
vectors = [
    ("integral-real", "3ff0000000000000", "1.0"),
    ("negative-zero", "8000000000000000", "0.0"),
    ("decimal-boundary", "3fd3333333333334", "0.30000000000000004"),
    ("integral-precision-boundary", "4340000000000000", "9007199254740992.0"),
    ("minimum-subnormal", "0000000000000001", "4.9406564584124654e-324"),
    ("maximum-finite", "7fefffffffffffff", "1.7976931348623157e+308"),
    ("positive-infinity", "7ff0000000000000", "9.0e+999"),
    ("negative-infinity", "fff0000000000000", "-9.0e+999"),
]
db, stmt = DB(), STMT()
try:
    if lib.sqlite3_open(b":memory:", ctypes.byref(db)) != 0: raise RuntimeError("sqlite3_open failed")
    if lib.sqlite3_prepare_v2(db, b"SELECT typeof(?1),quote(?1)", -1, ctypes.byref(stmt), None) != 0: raise RuntimeError("prepare failed")
    for ident, bits, expected in vectors:
        value = struct.unpack(">d", bytes.fromhex(bits))[0]
        if lib.sqlite3_bind_double(stmt, 1, value) != 0 or lib.sqlite3_step(stmt) != 100: raise RuntimeError("bind/step failed")
        storage = lib.sqlite3_column_text(stmt, 0).decode(); actual = lib.sqlite3_column_text(stmt, 1).decode()
        if storage != "real" or actual != expected: raise AssertionError(f"{ident}: {storage=} {actual=} {expected=}")
        print(json.dumps({"id":ident,"binary64Bits":bits,"storageClass":storage,"quote":actual}))
        lib.sqlite3_reset(stmt)
finally:
    if stmt: lib.sqlite3_finalize(stmt)
    if db: lib.sqlite3_close(db)
