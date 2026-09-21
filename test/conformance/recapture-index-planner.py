#!/usr/bin/env python3
"""Freshly reproduce the manifest-pinned index-planner database and capture."""
import argparse, json, pathlib, subprocess, sys, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]

def main():
 p=argparse.ArgumentParser(); p.add_argument('--library',required=True); a=p.parse_args()
 with tempfile.TemporaryDirectory(prefix='jsqlite-index-planner-') as tmp:
  fixture=pathlib.Path(tmp)/'index.db'; output=pathlib.Path(tmp)/'capture.json'
  subprocess.run([sys.executable,str(ROOT/'test/conformance/capture-index-planner.py'),'--library',a.library,'--spec',str(ROOT/'test/conformance/cases/stage3-index-planner.spec.json'),'--fixture',str(fixture),'--output',str(output)],check=True,cwd=ROOT)
  committed=json.loads((ROOT/'test/conformance/cases/stage3-index-planner.json').read_text()); fresh=json.loads(output.read_text())
  # Paths differ; all native bytes and observations must not.
  fresh['fixture']['path']=committed['fixture']['path']
  assert fresh==committed
 print('fresh pinned index-planner fixture and capture match exactly: 13 cases, 5 gates')
if __name__=='__main__':main()
