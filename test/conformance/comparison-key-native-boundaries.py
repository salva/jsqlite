#!/usr/bin/env python3
"""Pinned-native comparison/key boundaries; grants no public TS SQL credit."""
import ctypes
import json
import pathlib
import os
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / "test/conformance/cases/stage3-comparison-key.json").read_text())
pin = json.loads((ROOT / "reference/sqlite/manifest.json").read_text())
lib = ctypes.CDLL(sys.argv[1])
lib.sqlite3_sourceid.restype = ctypes.c_char_p
if lib.sqlite3_sourceid().decode() != pin["sqliteSourceId"]:
    raise SystemExit("native library source identity does not match pinned manifest")

DB, STMT = ctypes.c_void_p, ctypes.c_void_p
lib.sqlite3_open.argtypes = [ctypes.c_char_p, ctypes.POINTER(DB)]
lib.sqlite3_prepare_v2.argtypes = [DB, ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(STMT), ctypes.c_void_p]
lib.sqlite3_bind_int64.argtypes = [STMT, ctypes.c_int, ctypes.c_int64]
lib.sqlite3_bind_double.argtypes = [STMT, ctypes.c_int, ctypes.c_double]
lib.sqlite3_bind_text.argtypes = [STMT, ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_void_p]
lib.sqlite3_step.argtypes = [STMT]
lib.sqlite3_column_int64.argtypes = [STMT, ctypes.c_int]
lib.sqlite3_column_int64.restype = ctypes.c_int64
lib.sqlite3_finalize.argtypes = [STMT]
lib.sqlite3_exec.argtypes = [DB, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
lib.sqlite3_close.argtypes = [DB]
SQLITE_OK, SQLITE_ROW = 0, 100


def query_int(db, sql, bindings):
    stmt, keepalive = STMT(), []
    try:
        if lib.sqlite3_prepare_v2(db, sql.encode(), -1, ctypes.byref(stmt), None) != SQLITE_OK:
            raise RuntimeError(f"sqlite3_prepare_v2 failed for {sql}")
        for index, (kind, value) in enumerate(bindings, 1):
            if kind == "integer":
                rc = lib.sqlite3_bind_int64(stmt, index, int(value))
            elif kind == "real":
                rc = lib.sqlite3_bind_double(stmt, index, float(value))
            else:
                raw = bytes.fromhex(value)
                buffer = ctypes.create_string_buffer(raw)
                keepalive.append(buffer)  # SQLITE_STATIC is valid through step.
                rc = lib.sqlite3_bind_text(stmt, index, buffer, len(raw), None)
            if rc != SQLITE_OK:
                raise RuntimeError("sqlite3 bind failed")
        if lib.sqlite3_step(stmt) != SQLITE_ROW:
            raise RuntimeError("sqlite3_step failed")
        return int(lib.sqlite3_column_int64(stmt, 0))
    finally:
        if stmt:
            lib.sqlite3_finalize(stmt)


vectors = manifest["nativeDifferentialBoundaries"]
expected_ids = {
    "native-integer-real-exact-boundary", "native-binary-embedded-nul",
    "native-nocase-ascii-only", "native-rtrim-space-only",
    "native-index-integer-key-lookup",
}
if {vector["id"] for vector in vectors} != expected_ids:
    raise SystemExit("comparison/key native boundary set is incomplete")

# Internal VDBE symbols are intentionally not exported by the shared C-API
# oracle. Compile a development-only harness against the generated amalgamation
# from that same verified build, then require its source ID before observations.
work_root = pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])
record_work = work_root / "comparison-key-record-oracle"
record_work.mkdir(parents=True, exist_ok=True)
record_oracle = record_work / "record-oracle"
amalgamation = work_root / "oracle-build/build"
subprocess.run([
    os.environ.get("CC", "cc"), "-O0", f"-I{amalgamation}",
    str(ROOT / "test/conformance/comparison-key-record-oracle.c"),
    "-lm", "-o", str(record_oracle),
], check=True)
source_id = subprocess.run(
    [str(record_oracle), "--source-id"], check=True, text=True, capture_output=True
).stdout.strip()
if source_id != pin["sqliteSourceId"]:
    raise SystemExit("record comparator oracle source identity does not match pinned manifest")
record_vectors = manifest["nativeRecordComparatorBoundaries"]
expected_record_ids = {
    "native-record-decisive-packed-lhs",
    "native-record-equal-prefix-default-minus-one",
    "native-record-equal-prefix-default-zero",
    "native-record-equal-prefix-default-plus-one",
    "native-record-null-order-asc",
    "native-record-null-order-asc-bignull",
    "native-record-null-order-desc",
    "native-record-null-order-desc-bignull",
    "native-record-short-seek-rhs-default",
    "native-record-short-packed-lhs-corrupt",
    "native-record-truncated-payload-source-assumption",
}
if {vector["id"] for vector in record_vectors} != expected_record_ids:
    raise SystemExit("direct native record comparator boundary set is incomplete")

db = DB()
try:
    if lib.sqlite3_open(b":memory:", ctypes.byref(db)) != SQLITE_OK:
        raise RuntimeError("sqlite3_open failed")
    for vector in vectors:
        operation = vector["operation"]
        if operation == "numeric-compare":
            actual = query_int(db, "SELECT CASE WHEN ?1<?2 THEN -1 WHEN ?1>?2 THEN 1 ELSE 0 END", [
                ("integer", vector["integer"]), ("real", vector["real"]),
            ])
            expected = vector["expectedSign"]
        elif operation == "text-compare":
            collation = {"binary": "BINARY", "nocase": "NOCASE", "rtrim": "RTRIM"}[vector["collation"]]
            actual = query_int(db, f"SELECT CASE WHEN ?1 COLLATE {collation}<?2 THEN -1 WHEN ?1 COLLATE {collation}>?2 THEN 1 ELSE 0 END", [
                ("text", vector["leftHex"]), ("text", vector["rightHex"]),
            ])
            expected = vector["expectedSign"]
        else:
            setup = b"CREATE TABLE test1(cnt INTEGER, power INTEGER); CREATE INDEX test1_cnt ON test1(cnt); INSERT INTO test1 VALUES(6,64),(7,128);"
            if lib.sqlite3_exec(db, setup, None, None, None) != SQLITE_OK:
                raise RuntimeError("indexed lookup setup failed")
            actual = query_int(db, "SELECT power FROM test1 INDEXED BY test1_cnt WHERE cnt=?1", [("integer", vector["lookup"])])
            expected = int(vector["expected"])
        if actual != expected:
            raise AssertionError(f'{vector["id"]}: expected {expected}, got {actual}')
        print(json.dumps({"id": vector["id"], "actual": actual, "disposition": vector["disposition"]}))
finally:
    if db:
        lib.sqlite3_close(db)

for vector in record_vectors:
    command = [
        str(record_oracle), vector["leftHex"], vector["rightHex"],
        str(vector["sortFlags"]), str(vector["defaultRc"]),
    ]
    if "keyFieldCount" in vector:
        command.append(str(vector["keyFieldCount"]))
    observed = subprocess.run(
        command, check=True, text=True, capture_output=True
    ).stdout.strip().split()
    actual = {
        "sign": int(observed[0]),
        "eqSeen": bool(int(observed[1])),
        "errorCode": int(observed[2]),
    }
    expected = {**vector["expected"]}
    expected.setdefault("errorCode", 0)
    if actual != expected:
        raise AssertionError(f'{vector["id"]}: expected {expected}, got {actual}')
    print(json.dumps({"id": vector["id"], "actual": actual, "disposition": vector["disposition"]}))
