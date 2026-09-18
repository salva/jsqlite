#!/usr/bin/env python3
import json, pathlib, subprocess, sys, tempfile
root=pathlib.Path(__file__).parents[2]
spec_path=root/'test/conformance/cases/stage3-cte-architecture.spec.json'
capture_path=root/'test/conformance/cases/stage3-cte-architecture.json'
spec=json.load(open(spec_path)); cap=json.load(open(capture_path)); assert cap['source']==spec['source']
assert cap['accounting']=={'cases':17,'upstreamCreditCases':14,'companionsNoCredit':3,'encodingExecutions':51,'typescriptAttempted':0,'typescriptCredited':0}
by={(c['id'],c['databaseEncoding']):c for c in cap['captures']}; assert len(by)==51
for case in spec['cases']:
 assert case['credit'] in ('upstream','none')
 if case['credit']=='none': assert case.get('rationale')
 for enc in spec['encodings']:
  native=by[(case['id'],enc)]['native']; expected=case['expect']
  if 'error' in expected:
   got=native['prepare']; assert got['kind']=='error' and got['phase']==expected['error']['phase'] and got['message']==expected['error']['message'],(case['id'],enc,got)
  else:
   assert native['prepare']['kind']=='ok' and native['step']['kind']=='done',(case['id'],enc,native)
   simple=[]
   for row in native['rows']:
    simple.append([int(v['value']) if v['type']=='integer' else bytes.fromhex(v['utf8Hex']).decode() if v['type']=='text' else None for v in row])
   assert simple==expected['rows'],(case['id'],enc,simple)
lib=sys.argv[1] if len(sys.argv)>1 else None
if lib:
 with tempfile.TemporaryDirectory() as td:
  out=pathlib.Path(td)/'capture.json'
  subprocess.run([sys.executable,str(root/'test/conformance/capture-cte-architecture.py'),'--library',lib,'--spec',str(spec_path),'--output',str(out)],check=True)
  assert out.read_bytes()==capture_path.read_bytes()
print('cte architecture manifest: 14 upstream-credit + 3 no-credit companions; 51 pinned native encoding executions; TS 0/0')
