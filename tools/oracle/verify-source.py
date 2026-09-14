#!/usr/bin/env python3
"""Fail closed unless the checked-in SQLite archive and extraction match manifest."""
import hashlib
import json
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[2]
manifest_path = pathlib.Path(sys.argv[1]) if len(sys.argv) == 2 else root / "reference/sqlite/manifest.json"
m = json.loads(manifest_path.read_text(encoding="utf-8"))
base = manifest_path.parent
archive = base / m["archive"]
raw = archive.read_bytes()
if len(raw) != m["bytes"]:
    raise SystemExit("SQLite archive byte length differs from manifest")
if hashlib.sha256(raw).hexdigest() != m["sha256"]:
    raise SystemExit("SQLite archive SHA-256 differs from manifest")
if hashlib.sha3_256(raw).hexdigest() != m["sha3_256"]:
    raise SystemExit("SQLite archive SHA3-256 differs from manifest")
with zipfile.ZipFile(archive) as z:
    bad = z.testzip()
    if bad is not None:
        raise SystemExit(f"corrupt SQLite archive member: {bad}")
src = base / f"sqlite-src-{m['versionNumber']}"
if (src / "VERSION").read_text(encoding="utf-8").strip() != m["version"]:
    raise SystemExit("extracted VERSION differs from manifest")
if (src / "manifest.uuid").read_text(encoding="utf-8").strip() != m["fossilCheckin"]:
    raise SystemExit("extracted Fossil check-in differs from manifest")
print(json.dumps({"source": str(src), "sourceId": m["sqliteSourceId"]}, sort_keys=True))
