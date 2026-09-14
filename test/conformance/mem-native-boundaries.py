#!/usr/bin/env python3
"""Mandatory pinned-native Mem scalar boundaries; grants no public SQL credit."""
import ctypes
import json
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / "test/conformance/cases/stage3-mem.json").read_text())
pin = json.loads((ROOT / "reference/sqlite/manifest.json").read_text())
lib = ctypes.CDLL(sys.argv[1])
lib.sqlite3_sourceid.restype = ctypes.c_char_p
if lib.sqlite3_sourceid().decode() != pin["sqliteSourceId"]:
    raise SystemExit("native library source identity does not match pinned manifest")

DB = ctypes.c_void_p
STMT = ctypes.c_void_p
lib.sqlite3_open.argtypes = [ctypes.c_char_p, ctypes.POINTER(DB)]
lib.sqlite3_prepare_v2.argtypes = [DB, ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(STMT), ctypes.c_void_p]
lib.sqlite3_bind_double.argtypes = [STMT, ctypes.c_int, ctypes.c_double]
lib.sqlite3_step.argtypes = [STMT]
lib.sqlite3_column_text.argtypes = [STMT, ctypes.c_int]
lib.sqlite3_column_text.restype = ctypes.c_char_p
lib.sqlite3_finalize.argtypes = [STMT]
lib.sqlite3_close.argtypes = [DB]
SQLITE_OK, SQLITE_ROW = 0, 100
vectors = manifest["nativeDifferentialBoundaries"]
if {v["binary64Bits"] for v in vectors} != {"0000000000000000", "8000000000000000"}:
    raise SystemExit("both IEEE zero payloads must be mandatory native boundaries")
for vector in vectors:
    bits = bytes.fromhex(vector["binary64Bits"])
    value = struct.unpack(">d", bits)[0]
    db, stmt = DB(), STMT()
    try:
        if lib.sqlite3_open(b":memory:", ctypes.byref(db)) != SQLITE_OK:
            raise RuntimeError("sqlite3_open failed")
        if lib.sqlite3_prepare_v2(db, b"SELECT CAST(?1 AS TEXT)", -1, ctypes.byref(stmt), None) != SQLITE_OK:
            raise RuntimeError("sqlite3_prepare_v2 failed")
        if lib.sqlite3_bind_double(stmt, 1, value) != SQLITE_OK or lib.sqlite3_step(stmt) != SQLITE_ROW:
            raise RuntimeError("bind/step failed")
        actual = lib.sqlite3_column_text(stmt, 0).decode()
        if actual != vector["expectedText"]:
            raise AssertionError(f'{vector["id"]}: expected {vector["expectedText"]!r}, got {actual!r}')
        print(json.dumps({"id": vector["id"], "binary64Bits": vector["binary64Bits"], "text": actual}))
    finally:
        if stmt: lib.sqlite3_finalize(stmt)
        if db: lib.sqlite3_close(db)
