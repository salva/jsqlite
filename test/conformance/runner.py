#!/usr/bin/env python3
import collections
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads(
    (root / "test/conformance/cases/stage2-initial.json").read_text(encoding="utf-8")
)
upstream = manifest["upstreamCases"]
companions = manifest["companionCases"]
expected = upstream + companions
if len(expected) != len(set(expected)):
    raise SystemExit("manifest contains duplicate case IDs")

proc = subprocess.run(
    [
        sys.executable,
        str(root / "test/conformance/run-native.py"),
        sys.argv[1],
        str(root / "test/fixtures"),
    ],
    text=True,
    capture_output=True,
)
if proc.returncode:
    sys.stderr.write(proc.stderr)
    raise SystemExit(proc.returncode)

rows = [json.loads(line) for line in proc.stdout.splitlines()]
observed = collections.Counter(
    row["ref"]
    for row in rows
    if "ref" in row and not row["ref"].startswith("fixture-open:")
)
missing = sorted(set(expected) - observed.keys())
extra = sorted(observed.keys() - set(expected))
duplicates = sorted(ref for ref, count in observed.items() if count != 1)
if missing or extra or duplicates:
    raise SystemExit(
        f"manifest mismatch missing={missing} extra={extra} duplicates={duplicates}"
    )

artifact = root / "test/conformance/last-native.jsonl"
artifact.write_text(proc.stdout, encoding="utf-8")
sys.stdout.write(proc.stdout)
