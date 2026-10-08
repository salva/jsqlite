#!/usr/bin/env python3
"""Development-only explicit five-companion closure. Missing inputs fail, never skip.
Base contract: root/native.json + root/fixtures/*.db. Legacy captures unchanged.
"""
import argparse, hashlib, json, os, pathlib, sys
sys.dont_write_bytecode=True
import importlib.util
spec=importlib.util.spec_from_file_location('integration',pathlib.Path(__file__).with_name('integration.py'))
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
FILES=[f'test/conformance/skipscan-{name}-copy.test.mjs' for name in ['compiled','concurrent','corruption','memory','recovery']]
def fixture_root(explicit,work):return pathlib.Path(explicit) if explicit else pathlib.Path(work)/'skipscan-native'
def verify_base(root,pin):
 capture=json.loads((root/'native.json').read_text())
 if capture['source']['sqliteSourceId']!=pin['sqliteSourceId']:raise ValueError('capture source identity mismatch')
 for v in capture['variants']:
  for name,sha in [(v['fixture']['path'],v['fixture']['sha256']),(v['malformedSelectedRoot']['fixture'],v['malformedSelectedRoot']['sha256'])] if 'malformedSelectedRoot' in v else [(v['fixture']['path'],v['fixture']['sha256'])]:
   if pathlib.Path(name).is_absolute() or '..' in pathlib.Path(name).parts:raise ValueError('unsafe fixture path')
   if hashlib.sha256((root/'fixtures'/name).read_bytes()).hexdigest()!=sha:raise ValueError('fixture hash mismatch')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--fixture-root');p.add_argument('--library',required=True);a=p.parse_args()
 work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'skipscan-closure';work.mkdir(parents=True,exist_ok=True)
 root=fixture_root(a.fixture_root,pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])).resolve();root.mkdir(parents=True,exist_ok=True)
 env=dict(os.environ,SKIPSCAN_NATIVE_ROOT=str(root),SKIPSCAN_DEFAULT_PROOF='1',CHINOOK_DB='examples/browser/chinook.sqlite')
 commands=[['python3','docs/research/card-s-g/capture.py','--library',a.library,'--output-dir',str(root),'--fixture-dir','fixtures'],['python3','docs/research/card-s-g/capture-primitive-companions.py','--library',a.library,'--output-dir',str(root/'primitive-companions')],['python3','docs/research/card-s-g/capture-order-companions.py','--library',a.library,'--output',str(root/'order-native.json'),'--primitive-root',str(root/'primitive-companions')],['python3','docs/research/card-s-g/capture-corruption-companions.py','--library',a.library,'--output-dir',str(root/'corruption-companions'),'--primitive-root',str(root/'primitive-companions')]]
 report={'fixture_root':str(root),'environment':{k:env[k] for k in ['SKIPSCAN_NATIVE_ROOT','SKIPSCAN_DEFAULT_PROOF','SAIVAGE_CARD_WORK_ROOT']},'prerequisites':[],'results':[]}
 def save():(work/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 for i,command in enumerate(commands):
  r=runner.component(command,work/f'capture-{i}.log',180,env);report['prerequisites'].append(r);save()
  if r['exit'] or r['classification']!='completed':return 1
 verify_base(root,json.loads(pathlib.Path('reference/sqlite/manifest.json').read_text()))
 report['captures']={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()};save()
 for i,f in enumerate(FILES):
  r=runner.component(['node','--experimental-strip-types','--test',f],work/f'test-{i}.log',30,env);report['results'].append(r);save()
 return int(any(r['classification']!='completed' for r in report['results']))
if __name__=='__main__':raise SystemExit(main())
