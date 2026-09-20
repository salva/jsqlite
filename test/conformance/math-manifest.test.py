#!/usr/bin/env python3
import hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec_path=ROOT/'test/conformance/cases/stage3-math.spec.json'; native_path=ROOT/'test/conformance/cases/stage3-math.native.json'
spec=json.loads(spec_path.read_text()); native=json.loads(native_path.read_text()); pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
assert spec['source']['sourceId']==pin['sqliteSourceId'] and native['source']['sourceId']==pin['sqliteSourceId']
assert native['source']['specSha256']==hashlib.sha256(spec_path.read_bytes()).hexdigest()
assert spec['scope']=={'registryRows':30,'distinctNames':29,'selectedCases':20,'oracleObservations':60,'tsCredit':0}
assert len(spec['registry'])==30 and len(spec['cases'])==20 and len(native['observations'])==60
assert native['counts']=={'registryRows':30,'distinctNames':29,'selectedCases':20,'observations':60,'tsCredit':0}
assert native['profile']['compileOptionUsed']=={'ENABLE_COLUMN_METADATA':True,'ENABLE_MATH_FUNCTIONS':True}
assert native['profile']['c99MathFunctions'] is True
# Inventory must remain a literal projection of the pinned registration block.
func=(ROOT/'reference/sqlite/sqlite-src-3530400/src/func.c').read_text()
block=func[func.index('#ifdef SQLITE_ENABLE_MATH_FUNCTIONS',func.index('static FuncDef')):]
actual=[]
for macro,name,narg,user,callback in re.findall(r'\b(MFUNCTION|FUNCTION)\(\s*(\w+)\s*,\s*(-?\d+)\s*,\s*([^,]+?)\s*,\s*(?:0\s*,\s*)?(\w+)\s*\)',block):
 if name=='sign': break
 actual.append((macro,name,int(narg),user.strip(),callback))
expected=[(r['macro'],r['name'],r['nArg'],r['userData'],r['callback']) for r in spec['registry']]
assert actual[:30]==expected,(actual[:30],expected)
assert all(r['flags']==['SQLITE_FUNC_BUILTIN','SQLITE_FUNC_CONSTANT','SQLITE_UTF8'] and r['tsStatus']=='absent' for r in spec['registry'])
assert {(r['name'],r['nArg']) for r in spec['registry'] if r['name']=='log'}=={('log',1),('log',2)}
assert {(r['name'],r['callback']) for r in spec['registry'] if r['name'] in ('ceil','ceiling','pow','power')}=={('ceil','ceilingFunc'),('ceiling','ceilingFunc'),('pow','math2Func'),('power','math2Func')}
# Selected upstream assertions are identifiable and their SQL fragments still exist.
func7=(ROOT/'reference/sqlite/sqlite-src-3530400/test/func7.test').read_text()
for case in spec['cases']:
 assert case['encodings']==['UTF-8','UTF-16le','UTF-16be'] and case['credit']=='zero-until-public-typed-success'
 if 'upstreamAssertion' in case:
  for assertion_id in case['upstreamAssertion']['id'].split('/'):
   assert assertion_id in func7
  # Combined alias cases cite two adjacent assertions; require each called name.
  for name in set(re.findall(r'\b([a-z][a-z0-9]*)\s*\(',case['sql'],re.I))-{'select','round'}:
   assert re.search(r'\b'+re.escape(name)+r'\s*\(',func7,re.I),name
# Native REAL encoding is exact and JSON-safe, including signed zero/infinity.
for obs in native['observations']:
 for row in obs['rows']:
  for cell in row:
   if cell['type']=='real': assert re.fullmatch(r'[0-9a-f]{16}',cell['ieee754Hex']) and isinstance(cell['hexFloat'],str)
ids={c['id'] for c in spec['cases']}
for required in {'real-storage-signed-zero','domain-pole-overflow','coercion-prefix-blob','parameters','parameter-nonnumeric-blob','fixture-real-column','fixture-mixed-column','composition','precision-bits'}: assert required in ids
print('math manifest: 30 FuncDef rows/29 names, 20 cases, 60 pinned oracle observations, C99 rows available, TS credit 0/20')
