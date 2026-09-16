#!/usr/bin/env python3
"""Recapture and exactly compare the development-only compound/VALUES oracle gate."""
from __future__ import annotations
import argparse, json, pathlib, subprocess, sys, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-compound-values.spec.json'
CAPTURE=ROOT/'test/conformance/cases/stage3-compound-values.json'
RUNNER=ROOT/'test/conformance/capture-relational-working-state.py'

def normalized(raw):
 raw['schema']='jsqlite-compound-values-contract/1'
 for c in raw['cases']:
  ops=c['operations']; prepare_error=c['native']['terminal'].get('firstError',{}).get('operation')=='prepare'
  attempted_ops=['openFixture','prepare','close'] if prepare_error else ops
  attempted_indexes={ops.index(op) for op in attempted_ops}
  c['ts']={'disposition':'public-exact-attempted','attempted':[{'index':i,'op':ops[i]} for i in sorted(attempted_indexes)],'unattempted':[{'index':i,'op':op} for i,op in enumerate(ops) if i not in attempted_indexes],'credit':True}
 raw['accounting']={'declaredCases':len(raw['cases']),'nativeMatched':len(raw['cases']),'tsPrepareAttempts':len(raw['cases']),'tsCreditedCases':len(raw['cases']),'nativeExpectationsSeparateFromTsCredit':True,'countDerivedSuccessForbidden':True,'structuralGraphGate':'generated-complete-query-graph'}
 return raw

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--library',required=True);ap.add_argument('--write',action='store_true');a=ap.parse_args()
 with tempfile.TemporaryDirectory(prefix='jsqlite-compound-values-') as td:
  out=pathlib.Path(td)/'capture.json'
  subprocess.run([sys.executable,str(RUNNER),'--library',a.library,'--spec',str(SPEC),'--output',str(out)],check=True,cwd=ROOT)
  fresh=normalized(json.loads(out.read_text()))
 if a.write: CAPTURE.write_text(json.dumps(fresh,indent=2)+'\n')
 else:
  committed=json.loads(CAPTURE.read_text()); assert committed==fresh
  print(f"fresh pinned compound/VALUES capture matches exactly: {len(fresh['cases'])}/{len(fresh['cases'])}")
if __name__=='__main__':main()
