#!/usr/bin/env python3
"""Validate the scalar handoff by deriving active catalog metadata from pinned C."""
import hashlib,json,pathlib,re
R=pathlib.Path(__file__).resolve().parents[2]
S=R/'test/conformance/cases/stage3-ordinary-scalars.spec.json'; N=R/'test/conformance/cases/stage3-ordinary-scalars.native.json'; SRC=R/'reference/sqlite/sqlite-src-3530400'
s=json.loads(S.read_text()); n=json.loads(N.read_text()); manifest=json.loads((R/'reference/sqlite/manifest.json').read_text())
opts=set(n['source']['compileOptions']); defines={x.split('=',1)[0] for x in opts}
assert s['source']['sourceId']==manifest['sqliteSourceId']==n['source']['sourceId']
assert 'MAX_FUNCTION_ARG=1000' in opts and s['scope']['profileFunctionArgLimit']==1000

# Parse balanced macro invocations and preserve operands. Profile conditions in this
# catalog are resolved from captured compile options; product exclusions/scopes are
# explicit data, not silently dropped.
text=(SRC/'src/func.c').read_text(); region=text[text.index('static FuncDef aBuiltinFunc[]'):text.index('sqlite3InsertBuiltinFuncs')]
def calls(name):
 out=[]
 for m in re.finditer(r'\b'+name+r'\s*\(',region):
  i=m.end(); depth=1; quote=None
  while depth:
   c=region[i]
   if quote:
    if c==quote and region[i-1]!='\\':quote=None
   elif c in "'\"":quote=c
   elif c=='(':depth+=1
   elif c==')':depth-=1
   i+=1
  body=region[m.end():i-1]; args=[]; start=0; d=0
  for j,c in enumerate(body):
   if c=='(':d+=1
   elif c==')':d-=1
   elif c==',' and d==0:args.append(body[start:j].strip());start=j+1
  args.append(body[start:].strip()); out.append((m.start(),name,args))
 return out
macros=['FUNCTION','FUNCTION2','VFUNCTION','DFUNCTION','SFUNCTION','INLINE_FUNC','LIKEFUNC','MFUNCTION']
allcalls=sorted(sum((calls(x) for x in macros),[]))
# Evaluate the catalog's relevant conditional line context by source position.
def active(pos,name,args):
 prefix=region[:pos]; stack=[]
 for line in prefix.splitlines():
  z=line.strip()
  if z.startswith('#ifdef '): stack.append(z.split()[1] in defines)
  elif z.startswith('#ifndef '): stack.append(z.split()[1] not in defines)
  elif z.startswith('#if defined(SQLITE_DEBUG) || defined(SQLITE_ENABLE_FILESTAT)'): stack.append('SQLITE_DEBUG' in defines or 'SQLITE_ENABLE_FILESTAT' in defines)
  elif z.startswith('#if SQLITE_HAVE_C99_MATH_FUNCS'): stack.append(True)
  elif z.startswith('#if '): stack.append(False)
  elif z.startswith('#else') and stack: stack[-1]=not stack[-1]
  elif z.startswith('#endif') and stack: stack.pop()
 return all(stack)
# Product exclusions and separately owned roots are declared in spec.
excluded={'load_extension'}; future_math=True
source=[]
for pos,macro,args in allcalls:
 name=args[0]
 if not active(pos,name,args) or name in excluded or macro=='MFUNCTION': continue
 raw=int(args[1])
 # collapse mutually exclusive/duplicate LIKE definitions
 key=(macro,name,raw)
 if any(x['key']==key for x in source):continue
 flags={'BUILTIN','UTF8'}
 if macro in {'FUNCTION','FUNCTION2','INLINE_FUNC','LIKEFUNC'}:flags.add('CONSTANT')
 if macro=='DFUNCTION':flags.add('SLOCHNG')
 if macro=='INLINE_FUNC':
  flags.add('INLINE'); extra=args[3]
 elif macro=='FUNCTION2':extra=args[5]
 elif macro=='LIKEFUNC':extra=args[3]
 else:extra='0'
 if macro in {'FUNCTION','FUNCTION2','VFUNCTION','DFUNCTION'} and int(args[3]):flags.add('NEEDCOLL')
 token_flags={'SQLITE_FUNC_UNLIKELY':'UNLIKELY','SQLITE_FUNC_TYPEOF':'TYPEOF','SQLITE_SUBTYPE':'SUBTYPE','SQLITE_FUNC_LENGTH':'LENGTH','SQLITE_FUNC_BYTELEN':'BYTELEN','SQLITE_FUNC_LIKE':'LIKE','SQLITE_FUNC_CASE':'CASE'}
 for tok,label in token_flags.items():
  if tok in extra:flags.add(label)
 source.append({'key':key,'macro':macro,'name':name,'raw':raw,'flags':flags,'operands':args})
rows={(r['macro'],r['name'],a):r for r in s['registry'] for a in r['rawNArg']}
source_keys={x['key'] for x in source}; assert set(rows)==source_keys,(sorted(set(rows)-source_keys),sorted(source_keys-set(rows)))
for x in source:
 r=rows[x['key']]; assert set(r['funcDefFlags'])==x['flags'],(x['key'],r['funcDefFlags'],x['flags'])
 expected=[]
 for raw in r['rawNArg']:
  expected.append({'minimum':{-1:0,-3:1,-4:2}.get(raw,raw),'maximum':1000 if raw<0 else raw})
 assert r['rawFuncDefMatchArities']==expected,(r['name'],expected)

assert len(s['registry'])==50 and len(s['cases'])==34 and sum(len(c['encodings']) for c in s['cases'])==52
assert sum(r['tsStatus']=='implemented' for r in s['registry'])==12 and sum(r['tsStatus']=='absent' for r in s['registry'])==38
assert n['counts']=={'registrations':50,'cases':34,'observations':52}
assert n['source']['specSha256']==hashlib.sha256(S.read_bytes()).hexdigest()
assert len(n['observations'])==52 and len({(x['id'],x['encoding']) for x in n['observations']})==52
assert all(('rows'in x) or ('error'in x) for x in n['observations'])
byid={x['id']:x for x in n['observations']}
assert byid['case-variadic-limit-1000'].get('rows')
assert byid['case-variadic-over-limit-1001']['error']['phase']=='prepare'
covered={z for c in s['cases'] for z in c['coversRegistrations']}; absent={r['name'] for r in s['registry'] if r['tsStatus']=='absent'}; assert absent<=covered
assert set(s['scope']['publicUnsupportedCoverage'])==absent
assert all('provenance'in c and c['provenance']['kind'] in {'upstream-assertion-plus-local-companion','source-authored-local-companion'} for c in s['cases'])
ids={a['assertionId'] for a in s['upstreamAssertions']}
for c in s['cases']:
 assert set(c['provenance'].get('assertionIds',[]))<=ids
for a in s['upstreamAssertions']:
 lines=(SRC/'test'/a['sourceTest']).read_text().splitlines(True); body=''.join(lines[a['lineStart']-1:a['lineEnd']]); assert hashlib.sha256(body.encode()).hexdigest()==a['bodySha256']; assert 'setup'in a
assert set(s['scope']['sliceProvenance'])==set(s['scope']['implementationBranchesBySlice'])
for f in s['scope']['publicFetchFixtures'].values():assert (R/f).is_file()
# Validate exact macro-definition and assertion setup provenance.
mp=s['scope']['macroDefinitionProvenance']; ml=(SRC/mp['path']).read_text().splitlines(True); mb=''.join(ml[mp['lineStart']-1:mp['lineEnd']]); assert len(mb.encode())==mp['bytes'] and hashlib.sha256(mb.encode()).hexdigest()==mp['sha256']
for a in s['upstreamAssertions']:
 setup=a['setup']; assert setup['kind'] in {'upstream-range','embedded-in-assertion-body','self-contained-no-fixture'}
 if setup['kind']=='upstream-range':
  lines=(SRC/'test'/a['sourceTest']).read_text().splitlines(True); body=''.join(lines[setup['lineStart']-1:setup['lineEnd']]); assert len(body.encode())==setup['bytes'] and hashlib.sha256(body.encode()).hexdigest()==setup['sha256']
 else: assert setup.get('rationale')
# Every case has nonempty, existing pinned source ownership. Wildcards and /qualifiers
# name source families/branches; validate their concrete leading symbol.
def valid_branch(z):
 path,sep,sym=z.partition(':'); f=SRC/path
 if not (sep and f.is_file() and sym): return False
 text=f.read_text(); token=sym.split('/')[0].split('(')[0].split('|')[0].rstrip('*').strip()
 return bool(token) and token in text
for c in s['cases']:
 b=c['provenance'].get('sourceBranches',[]); assert b and all(valid_branch(z) for z in b),(c['id'],b)
# Every implementation slice owns cases, and every absent row is linked from its
# source-owned slice to a case that explicitly covers that registration.
for sl,x in s['scope']['sliceProvenance'].items():
 assert x['sourceBranches'] and all(valid_branch(z) for z in x['sourceBranches']); assert x['caseIds'],sl
 known={c['id'] for c in s['cases']}; assert set(x['caseIds'])<=known
for r in s['registry']:
 if r['tsStatus']=='absent':
  owned=set(s['scope']['sliceProvenance'][r['slice']]['caseIds']); assert any(c['id'] in owned and r['name'] in c['coversRegistrations'] for c in s['cases']),r['name']
# Raw -3 matching admits one argument, but exact WAGGREGATE registration wins;
# ordinary scalar minmaxFunc starts at two arguments.
for name in ('min','max'):
 r=next(x for x in s['registry'] if x['name']==name); assert r['rawFuncDefMatchArities']==[{'minimum':1,'maximum':1000}]; assert r['effectiveScalarArities']==[{'minimum':2,'maximum':1000}]; assert r['overloadResolution']['oneArgumentOwner'].startswith('aggregate/window')
mo=s['scope']['minMaxOverloadOwnership']; assert mo['caseId']=='case-minmax-overload-discriminator'
o=byid[mo['caseId']]; assert [v['value'] for v in o['rows'][0]]==['1','3','1','3','1']
print('ordinary scalar contract: 50 active in-scope rows, 34 cases/52 native observations, 12 implemented/38 absent; profile-specific catalog, overload ownership, source/test/setup provenance verified')
