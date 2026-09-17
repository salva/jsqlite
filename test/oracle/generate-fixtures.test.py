#!/usr/bin/env python3
import hashlib,json,pathlib,stat
root=pathlib.Path(__file__).resolve().parents[2]/"test/fixtures"
c=json.loads((root/"CURRENT.json").read_text()); g=root/"generations"/c["generationId"]; cat=json.loads((g/"catalog.json").read_text())
for e in cat["semantic"]["fixtures"]:
 p=g/e["path"]; assert p.stat().st_size==e["bytes"]; assert hashlib.sha256(p.read_bytes()).hexdigest()==e["sha256"]; assert not (p.stat().st_mode&stat.S_IWUSR)
 for s in ("-wal","-shm","-journal"): assert not pathlib.Path(str(p)+s).exists()
assert len(cat["semantic"]["fixtures"]) in (8,18,20,22,23,25,27,30)
print(f"fixture catalog verified: {len(cat['semantic']['fixtures'])} immutable databases, hashes and sidecar absence")
