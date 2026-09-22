#!/usr/bin/env python3
"""Freshly reproduce all manifest-pinned index-planner databases/captures."""
import argparse, json, pathlib, subprocess, sys, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser(); p.add_argument('--library',required=True); a=p.parse_args()
 with tempfile.TemporaryDirectory(prefix='jsqlite-index-planner-') as tmp:
  output=pathlib.Path(tmp)/'capture.json'
  subprocess.run([sys.executable,str(ROOT/'test/conformance/capture-index-planner.py'),'--library',a.library,'--spec',str(ROOT/'test/conformance/cases/stage3-index-planner.spec.json'),'--fixture-dir',tmp,'--output',str(output)],check=True,cwd=ROOT)
  committed=json.loads((ROOT/'test/conformance/cases/stage3-index-planner.json').read_text()); fresh=json.loads(output.read_text())
  for actual,expected in zip(fresh['variants'],committed['variants'],strict=True): actual['fixture']['path']=expected['fixture']['path']
  assert fresh==committed
 print(f"fresh pinned index-planner fixtures/captures match exactly: {len(committed['variants'])} encodings, {len(committed['variants'][0]['cases'])} cases each, {len(committed['atomicGates'])} gates")
if __name__=='__main__':main()
