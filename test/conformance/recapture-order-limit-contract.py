#!/usr/bin/env python3
"""Freshly recapture and compare the pinned ORDER/LIMIT native oracle.

Development-only. The library must be built from reference/sqlite/manifest.json
with ENABLE_COLUMN_METADATA, as required by the shared capture implementation.
"""
from __future__ import annotations
import argparse, json, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = ROOT / "test/conformance/cases/stage3-order-limit-contract.spec.json"
CAPTURE = ROOT / "test/conformance/cases/stage3-order-limit-contract.json"
RUNNER = ROOT / "test/conformance/capture-relational-working-state.py"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", required=True)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="jsqlite-order-limit-") as directory:
        output = pathlib.Path(directory) / "capture.json"
        subprocess.run([
            sys.executable, str(RUNNER), "--library", args.library,
            "--spec", str(SPEC), "--output", str(output),
        ], check=True, cwd=ROOT)
        committed = json.loads(CAPTURE.read_text())
        fresh = json.loads(output.read_text())
    assert len(committed["cases"]) == len(fresh["cases"]) == 24
    for expected, actual in zip(committed["cases"], fresh["cases"], strict=True):
        assert expected["id"] == actual["id"]
        assert expected["native"] == actual["native"], expected["id"]
    print("fresh pinned ORDER/LIMIT native sections match exactly: 24/24")


if __name__ == "__main__":
    main()
