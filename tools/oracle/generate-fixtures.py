#!/usr/bin/env python3
"""Generate the bounded immutable Stage-2 fixture generation."""
import argparse, hashlib, json, os, pathlib, shutil, stat, subprocess, tempfile

def canonical(v): return (json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False)+"\n").encode()
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
p=argparse.ArgumentParser(); p.add_argument("--manifest",required=True); p.add_argument("--profile",required=True); p.add_argument("--oracle",required=True); p.add_argument("--spec-dir",required=True); p.add_argument("--fixture-root",required=True); a=p.parse_args()
m=json.load(open(a.manifest)); profile=json.load(open(a.profile)); root=pathlib.Path(a.fixture_root)
if profile["sourceId"]!=m["sqliteSourceId"] or profile["version"]!=m["version"]: raise SystemExit("profile identity mismatch")
helper=pathlib.Path(a.oracle).with_name("sqlite-fixture")
items=[("empty","UTF-8"),("close","UTF-8"),("bind","UTF-8"),("meta","UTF-8"),("encoding-utf8","UTF-8"),("encoding-utf16le","UTF-16le"),("encoding-utf16be","UTF-16be"),("readonly","UTF-8")]
root.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix="fixture-stage-",dir=root) as td:
 d=pathlib.Path(td); generated=d/"generated"; generated.mkdir(); entries=[]
 for ident,enc in items:
  out=generated/f"{ident}.db"; subprocess.run([helper,ident,enc,out],check=True)
  if any(pathlib.Path(str(out)+s).exists() for s in ("-wal","-shm","-journal")): raise SystemExit("sidecar produced")
  out.chmod(stat.S_IRUSR|stat.S_IRGRP|stat.S_IROTH)
  entries.append({"id":ident,"encoding":enc,"path":f"generated/{ident}.db","bytes":out.stat().st_size,"sha256":sha(out),"readOnly":True,"sidecars":[]})
 semantic={"schema":"jsqlite-fixture-semantic-v1","sourceId":m["sqliteSourceId"],"version":m["version"],"fixtures":entries}
 gid="g-"+hashlib.sha256(canonical(semantic)).hexdigest(); semantic["generationId"]=gid
 catalog={"schema":"jsqlite-fixture-catalog-v1","semantic":semantic,"producer":profile}
 (d/"catalog.json").write_bytes(canonical(catalog)); target=root/"generations"/gid; target.parent.mkdir(exist_ok=True)
 if target.exists():
  for e in entries:
   if sha(target/e["path"])!=e["sha256"]: raise SystemExit("existing generation differs")
 else: shutil.move(d,target)
 current={"generationId":gid,"semanticCatalogSha256":hashlib.sha256(canonical(semantic)).hexdigest()}
 tmp=root/"CURRENT.json.new"; tmp.write_bytes(canonical(current)); os.replace(tmp,root/"CURRENT.json")
 print(gid)
