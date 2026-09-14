#!/usr/bin/env python3
"""Generate bounded Stage 2 per-case operation data from admitted IDs."""
import argparse,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
m=json.loads((root/'test/conformance/cases/stage2-initial.json').read_text())
def fixture(case):
 if case.startswith('close.test:'): return 'close'
 if case.startswith('capi3c.test:capi3c-1.') or case.startswith('capi3c.test:capi3c-2.'): return 'empty'
 if case.startswith('capi3c.test:capi3c-5.'): return 'meta'
 if case.startswith('enc2.test:enc2-1.'): return 'encoding-utf8'
 if case.startswith('enc2.test:enc2-2.'): return 'encoding-utf16le'
 if case.startswith('enc2.test:enc2-3.'): return 'encoding-utf16be'
 if case.startswith('readonly.test:'): return 'readonly'
 return 'bind'
cases=[]
for case in m['upstreamCases']+m['companionCases']:
 f=fixture(case); ops=[{'key':'openFixture','op':'openFixture','fixture':f}]
 if case.startswith('close.test:'): ops += [{'key':'prepare','op':'prepare','sql':'SELECT * FROM t1'},{'key':'closeDeferred','op':'closeDeferred'}]
 elif case.startswith('capi3c.test:capi3c-5.') or case=='transport:duplicate-ordered-columns': ops += [{'key':'prepare','op':'prepare','sql':'SELECT a,b,c FROM t1'},{'key':'metadata','op':'columnMetadata','column':0}]
 elif case.startswith('bind.test:') or case.startswith('bind-') or case.startswith('transport:'): ops += [{'key':'prepare','op':'prepare','sql':'SELECT $one,$::two,$x(-z-)'},{'key':'bind','op':'bind','index':1,'value':32},{'key':'step','op':'step'}]
 else: ops += [{'key':'prepare','op':'prepare','sql':'SELECT * FROM t1'},{'key':'step','op':'step'}]
 cases.append({'id':case,'credit':'upstream' if case in m['upstreamCases'] else 'no-credit-companion','fixture':f,'setup':[],'operations':ops,'expected':{'disposition':'unimplemented-temporary','error':{'name':'JSQLiteError','kind':'unsupported','unsupportedClassification':'temporary'}}})
rendered=json.dumps({'schema':'jsqlite-ts-cases/1','cases':cases},indent=2)+'\n'; target=root/'test/conformance/cases/stage2-ts.json'
a=argparse.ArgumentParser(); a.add_argument('--check',action='store_true'); args=a.parse_args()
if args.check:
 if not target.exists() or target.read_text()!=rendered:
  print(f'{target.relative_to(root)} is stale',file=sys.stderr); raise SystemExit(1)
 print('TS case data matches deterministic generator (38 upstream + 9 companions)')
else: target.write_text(rendered)
