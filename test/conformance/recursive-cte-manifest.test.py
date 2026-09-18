#!/usr/bin/env python3
import json,pathlib,subprocess,sys,tempfile
root=pathlib.Path(__file__).parents[2]; spec=root/'test/conformance/cases/stage3-recursive-cte.spec.json'; capture=root/'test/conformance/cases/stage3-recursive-cte.json'
s=json.load(open(spec)); c=json.load(open(capture)); assert c['source']==s['source']; assert c['accounting']=={'cases':7,'upstreamCreditCases':5,'companionsNoCredit':2,'encodingExecutions':21,'typescriptAttempted':0,'typescriptCredited':0}; assert len(c['captures'])==21
for case in s['cases']:
 for enc in s['encodings']:
  got=next(x['native'] for x in c['captures'] if x['id']==case['id'] and x['databaseEncoding']==enc); expected=case['expect']
  if 'error' in expected: assert got['prepare']['kind']=='error' and got['prepare']['phase']==expected['error']['phase'] and got['prepare']['message']==expected['error']['message']
  else:
   rows=[[int(v['value']) if v['type']=='integer' else bytes.fromhex(v['utf8Hex']).decode() if v['type']=='text' else None if v['type']=='null' else bytes.fromhex(v['hex']) for v in row] for row in got['rows']]; assert rows==expected['rows'] and got['step']['kind']=='done'
if len(sys.argv)>1:
 with tempfile.TemporaryDirectory() as td:
  out=pathlib.Path(td)/'capture.json';subprocess.run([sys.executable,str(root/'test/conformance/capture-cte-architecture.py'),'--library',sys.argv[1],'--spec',str(spec),'--output',str(out)],check=True);assert out.read_bytes()==capture.read_bytes()
print('recursive CTE manifest: 5 upstream-credit + 2 no-credit companions; 21 pinned native encoding executions; public matrix separate')
