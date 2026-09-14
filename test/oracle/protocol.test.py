#!/usr/bin/env python3
"""Focused reproducible native-oracle acceptance check (development only)."""
import json
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((root / "reference/sqlite/manifest.json").read_text())
env = dict(os.environ)
if not env.get("ORACLE_WORK_ROOT") and not env.get("SAIVAGE_CARD_WORK_ROOT"):
    env["ORACLE_WORK_ROOT"] = "/tmp/jsqlite2-oracle-build"
subprocess.run([str(root / "tools/oracle/build.sh")], cwd=root, env=env, check=True)
work = pathlib.Path(env.get("ORACLE_WORK_ROOT") or pathlib.Path(env["SAIVAGE_CARD_WORK_ROOT"]) / "oracle-build")
result = subprocess.run([str(work / "build/sqlite-oracle"), "--self-check", manifest["sqliteSourceId"]], text=True, capture_output=True, check=True)
profile = json.loads(result.stdout)
assert profile["version"] == manifest["version"]
assert profile["versionNumber"] == manifest["versionNumber"]
assert profile["sourceId"] == manifest["sqliteSourceId"]
assert set(profile["compileOptions"]) == {"ENABLE_COLUMN_METADATA", "ENABLE_MATH_FUNCTIONS"}
assert all(profile["probes"].values())
print("oracle self-check passed: pinned identity, compile options, JSON/math/UTF probes")
