#!/usr/bin/env python3
"""Recapture exact pinned-native compound boundary companions; grants no TS credit."""
from __future__ import annotations
import argparse,json,pathlib,subprocess,sys,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
SPEC=ROOT/'test/conformance/cases/stage3-compound-values-boundaries.spec.json'
CAPTURE=ROOT/'test/conformance/cases/stage3-compound-values-boundaries.json'
RUNNER=ROOT/'test/conformance/capture-relational-working-state.py'
def normalize(d):
 d['schema']='jsqlite-compound-values-boundaries/1'
 for c in d['cases']:
  ops=c['operations']; prep=c['native']['terminal'].get('firstError',{}).get('operation')=='prepare'
  attempted=[] if prep else [{'index':ops.index('prepare'),'op':'prepare','expectedOutcome':'temporary-unsupported'}]
  attempted_indexes={x['index'] for x in attempted}
  c['ts']={'disposition':'native-prepare-error-no-ts-attempt' if prep else 'temporary-unsupported','attempted':attempted,'unattempted':[{'index':i,'op':op} for i,op in enumerate(ops) if i not in attempted_indexes],'credit':False}
 d['accounting']={'declaredCases':len(d['cases']),'nativeMatched':len(d['cases']),'tsPrepareAttempts':sum(bool(c['ts']['attempted']) for c in d['cases']),'tsCreditedCases':0,'nativeExpectationsSeparateFromTsCredit':True,'countDerivedSuccessForbidden':True,'classification':'no-credit-boundary-companions'}
 return d
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--library',required=True);ap.add_argument('--write',action='store_true');a=ap.parse_args()
 with tempfile.TemporaryDirectory(prefix='jsqlite-compound-boundaries-') as td:
  out=pathlib.Path(td)/'capture.json';subprocess.run([sys.executable,str(RUNNER),'--library',a.library,'--spec',str(SPEC),'--output',str(out)],check=True,cwd=ROOT);fresh=normalize(json.loads(out.read_text()))
 if a.write:CAPTURE.write_text(json.dumps(fresh,indent=2)+'\n')
 else:
  assert json.loads(CAPTURE.read_text())==fresh
  print(f"fresh pinned compound boundary capture matches exactly: {len(fresh['cases'])}/{len(fresh['cases'])}")
if __name__=='__main__':main()
