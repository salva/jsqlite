#!/usr/bin/env python3
"""Generate the bounded executable TS sequences from the admitted case IDs."""
import argparse,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
m=json.loads((root/'test/conformance/cases/stage2-initial.json').read_text())

def fixture_for(case):
 if case.startswith('close.test:'): return 'close'
 if case.startswith('capi3c.test:capi3c-1.') or case.startswith('capi3c.test:capi3c-2.'): return 'empty'
 if case.startswith('capi3c.test:capi3c-5.'): return 'meta'
 if case.startswith('enc2.test:enc2-1.'): return 'encoding-utf8'
 if case.startswith('enc2.test:enc2-2.'): return 'encoding-utf16le'
 if case.startswith('enc2.test:enc2-3.'): return 'encoding-utf16be'
 if case.startswith('readonly.test:'): return 'readonly'
 return 'bind'

def op(key, operation, **kw): return {'key':key,'op':operation,**kw}
def common(fixture): return [op('open','openFixture',fixture=fixture)]
def prepare(ops, sql, key='prepare'): ops.append(op(key,'prepare',sql=sql))
def sequence(case, fixture):
 o=common(fixture)
 if case.startswith('close.test:'):
  suffix=case.rsplit('-',1)[1]
  prepare(o,'SELECT * FROM t1')
  if suffix=='1.1': o.append(op('close','closeDeferred')); return o
  if suffix in ('1.3.1','1.3.2','1.3.3','1.4.1','1.4.2','1.4.3','1.4.4'): o.append(op('step1','step'))
  o.append(op('close','closeDeferred'))
  if suffix=='1.3.2': o.append(op('column','columnText',column=0))
  if suffix=='1.3.3': o.append(op('finalize','finalize'))
  if suffix in ('1.4.2','1.4.3','1.4.4'): o.append(op('step2','step'))
  if suffix=='1.4.3': o.append(op('prepareAfterClose','prepare',sql='SELECT * FROM sqlite_master'))
  if suffix in ('1.2.2','1.4.4'): o.append(op('finalize','finalize'))
  return o
 if case.startswith('capi3c.test:capi3c-1.'):
  sql={'capi3c.test:capi3c-1.1':'SELECT name FROM sqlite_master','capi3c.test:capi3c-1.4':'SELECT name FROM sqlite_master;SELECT 10','capi3c.test:capi3c-1.5':'SELECT namex FROM sqlite_master'}[case]
  prepare(o,sql)
  if case!='capi3c.test:capi3c-1.5': o.append(op('finalize','finalize'))
  return o
 if case.startswith('capi3c.test:capi3c-2.'):
  sql={'capi3c.test:capi3c-2.1':'SELECT name FROM sqlite_master','capi3c.test:capi3c-2.2':'SELECT name FROM sqlite_master;SELECT 10','capi3c.test:capi3c-2.3':'SELECT namex FROM sqlite_master'}[case]
  prepare(o,sql) # public JS-text adaptation of native-only prepare16
  if case!='capi3c.test:capi3c-2.3': o.append(op('finalize','finalize'))
  return o
 if case.startswith('bind.test:bind-2.1.'):
  prepare(o,'SELECT $one,$::two,$x(-z-)')
  n=case.rsplit('.',1)[1]
  if n=='1': o.append(op('count','parameterCount'))
  elif n in ('2','3','4'): o.append(op('name','parameterName',index=int(n)-1))
  else:
   names={'5':'$one','6':'$::two','7':'$x(-z-)','8':':hi'}
   o.append(op('index','parameterIndex',name=names[n]))
  return o
 if case=='bind.test:bind-3.1':
  prepare(o,'SELECT $one,$::two,$x(-z-)')
  for i,v in enumerate((32,-2000000000000,2000000000000),1): o.append(op(f'bind{i}','bind',index=i,value={'js':'bigint','decimal':str(v)}))
  o.append(op('step','step')); return o
 if case.startswith('capi3c.test:capi3c-5.'):
  prepare(o,'SELECT a,b,c FROM t1')
  suffix=case.split('capi3c-5.',1)[1]
  if suffix=='0': o.append(op('count','columnCount'))
  elif suffix in ('1.1','1.3','1.5','1.8','1.10','1.12'): o.append(op('metadata','statementMetadata'))
  elif suffix=='2': o.append(op('step','step'))
  elif suffix=='4.1': o.extend([op('step','step'),op('type0','columnType',column=0),op('type1','columnType',column=1),op('type2','columnType',column=2)])
  return o
 if case.startswith('enc2.test:'):
  prepare(o,'SELECT a,b,c FROM t1'); o.append(op('step','step')); o.extend(op(f'column{i}','column',column=i) for i in range(3)); return o
 if case.startswith('readonly.test:'):
  prepare(o,'SELECT a,b FROM t1 ORDER BY a'); o.append(op('step','step')); return o
 # Explicit no-credit companions.
 if case in ('bind-reset-retains','bind-clear-to-null','bind-clear-observation','bind-finalize'):
  prepare(o,'SELECT $one,$::two,$x(-z-)')
  for i,v in enumerate((32,-2000000000000,2000000000000),1): o.append(op(f'bind{i}','bind',index=i,value={'js':'bigint','decimal':str(v)}))
  o.append(op('step1','step')); o.append(op('reset1','reset'))
  if case=='bind-reset-retains': o.extend([op('reset2','reset'),op('step2','step'),op('column0','columnInteger',column=0)])
  elif case=='bind-clear-to-null': o.append(op('clear','clearBindings'))
  elif case=='bind-clear-observation': o.extend([op('clear','clearBindings'),op('step2','step'),op('type0','columnType',column=0)])
  else: o.append(op('finalize','finalize'))
  return o
 if case=='transport:int64-extrema':
  prepare(o,'SELECT ?,?')
  for i,v in enumerate(('-9223372036854775808','9223372036854775807'),1): o.append(op(f'bind{i}','bind',index=i,value={'js':'bigint','decimal':v}))
  o.extend([op('step','step'),op('column0','columnInteger',column=0),op('column1','columnInteger',column=1)]); return o
 if case=='transport:real-specials':
  prepare(o,'SELECT ?,?,?,?')
  vals=['432ff973cafa8000','7ff8000000000000','7ff0000000000000','fff0000000000000']
  for i,v in enumerate(vals,1): o.append(op(f'bind{i}','bind',index=i,value={'js':'number','ieee754be':v}))
  o.extend([op('step','step'),op('column0','column',column=0),op('column1','column',column=1),op('column2','column',column=2),op('column3','column',column=3)]); return o
 if case=='transport:null-empty-text-empty-blob':
  prepare(o,'SELECT ?,?,?')
  vals=[{'js':'null'},{'js':'string','value':''},{'js':'uint8array','hex':''}]
  for i,v in enumerate(vals,1): o.append(op(f'bind{i}','bind',index=i,value=v))
  o.extend([op('step','step'),op('column0','column',column=0),op('column1','column',column=1),op('column2','column',column=2)]); return o
 if case=='transport:blob-00ff80':
  prepare(o,'SELECT ?'); o.extend([op('bind','bind',index=1,value={'js':'uint8array','hex':'00ff80'}),op('step','step'),op('column','columnBlob',column=0)]); return o
 if case=='transport:duplicate-ordered-columns':
  prepare(o,'SELECT 1 AS x,2 AS x'); o.append(op('metadata','statementMetadata')); return o
 raise ValueError(case)

cases=[]
for case in m['upstreamCases']+m['companionCases']:
 fixture=fixture_for(case)
 operations=sequence(case,fixture)
 expected_attempt=next({'index':i,'key':operation['key'],'op':operation['op']} for i,operation in enumerate(operations) if operation['op']=='prepare')
 cases.append({'id':case,'credit':'upstream' if case in m['upstreamCases'] else 'no-credit-companion','fixture':fixture,'setup':[], 'operations':operations,'expected':{'disposition':'unimplemented-temporary','attempted':expected_attempt,'error':{'name':'JSQLiteError','kind':'unsupported','code':None,'extendedCode':None,'unsupportedClassification':'temporary'}}})
out={'schema':'jsqlite-ts-cases/1','cases':cases}; rendered=json.dumps(out,indent=2)+'\n'; target=root/'test/conformance/cases/stage2-ts.json'
p=argparse.ArgumentParser(); p.add_argument('--check',action='store_true'); args=p.parse_args()
if args.check:
 if not target.exists() or target.read_text()!=rendered:
  print(f'{target.relative_to(root)} is stale; run {pathlib.Path(__file__).relative_to(root)}',file=sys.stderr); raise SystemExit(1)
 print('TS case data matches its deterministic generator (38 upstream + 9 companions)')
else: target.write_text(rendered)
