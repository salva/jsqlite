#!/usr/bin/env python3
"""Validate the scalar handoff against pinned source, current TS, and capture data."""
import ast, hashlib, json, pathlib, re

R=pathlib.Path(__file__).resolve().parents[2]
S=R/'test/conformance/cases/stage3-ordinary-scalars.spec.json'
N=R/'test/conformance/cases/stage3-ordinary-scalars.native.json'
SRC=R/'reference/sqlite/sqlite-src-3530400'
s=json.loads(S.read_text()); n=json.loads(N.read_text())
manifest=json.loads((R/'reference/sqlite/manifest.json').read_text())
assert s['schemaVersion']==n['schemaVersion']==1
assert s['source']['version']==manifest['version'] and s['source']['sourceId']==manifest['sqliteSourceId']
assert len(s['registry'])==48 and len(s['cases'])==30
executions=sum(len(x['encodings']) for x in s['cases']); assert executions==48
assert n['kind']=='native-reference-only-no-ts-credit'
assert n['counts']=={'registrations':48,'cases':30,'observations':48}
assert n['source']['sourceId']==s['source']['sourceId']
assert n['source']['specSha256']==hashlib.sha256(S.read_bytes()).hexdigest()
assert len(n['observations'])==48 and len({(x['id'],x['encoding']) for x in n['observations']})==48
assert all(('rows' in x) or ('error' in x) for x in n['observations'])
assert all(x.get('error',{}).get('phase') in (None,'prepare','step') for x in n['observations'])

# Independently parse active production catalog calls for this profile.  This
# intentionally rejects conditional/debug, compile diagnostics, extension,
# internal fpdecode/parseuri, aggregate/window, date/time, math, and JSON rows.
func=(SRC/'src/func.c').read_text()
region=func[func.index('static FuncDef aBuiltinFunc[]'):func.index('sqlite3InsertBuiltinFuncs')]
call_re=re.compile(r'^\s*(FUNCTION2|FUNCTION|VFUNCTION|DFUNCTION|INLINE_FUNC|LIKEFUNC)\(\s*([A-Za-z_]+)\s*,\s*(-?\d+)',re.M)
parsed=[(m.group(1),m.group(2),int(m.group(3))) for m in call_re.finditer(region)]
excluded={'soundex','sqlite_offset','sqlite_filestat','fpdecode','parseuri','unknown','ln','log'}
rows={(r['macro'],r['name'],a) for r in s['registry'] for a in r['rawNArg']}
source={(m,name,a) for m,name,a in parsed if name not in excluded and name not in {'like'} or False}
# LIKE appears twice in mutually exclusive preprocessor branches; collapse it.
source={(m,name,a) for m,name,a in parsed if name not in excluded}
source={x for x in source if x[1] not in {'sqlite_compileoption_used','sqlite_compileoption_get'}}
assert rows==source,(sorted(rows-source),sorted(source-rows))

# Macro-derived symbolic flags and callback negative-arity matching rules.
def flags(macro,name):
    base={'BUILTIN','UTF8'}
    if macro in {'FUNCTION','FUNCTION2','INLINE_FUNC','LIKEFUNC'}: base.add('CONSTANT')
    if macro=='DFUNCTION': base.add('SLOCHNG')
    if macro=='INLINE_FUNC': base.add('INLINE')
    if name in {'unlikely','likelihood','likely'}: base.add('UNLIKELY')
    if name in {'min','max','nullif'}: base.add('NEEDCOLL')
    if name=='typeof': base.add('TYPEOF')
    if name=='subtype': base|={'TYPEOF','SUBTYPE'}
    if name=='length': base.add('LENGTH')
    if name=='octet_length': base.add('BYTELEN')
    if name in {'glob','like'}: base.add('LIKE')
    if name=='glob': base.add('CASE')
    return base
for r in s['registry']:
    assert set(r['funcDefFlags'])==flags(r['macro'],r['name']),(r['name'],r['funcDefFlags'])
    expected=[]
    for raw in r['rawNArg']:
        lo={-1:0,-3:1,-4:2}.get(raw,raw); hi=127 if raw<0 else raw
        expected.append({'minimum':lo,'maximum':hi})
    assert r['acceptedArities']==expected,(r['name'],expected)

keys=[(x['name'],tuple(x['rawNArg'])) for x in s['registry']]; assert len(keys)==len(set(keys))
assert sum(x['tsStatus']=='implemented' for x in s['registry'])==12
assert sum(x['tsStatus']=='absent' for x in s['registry'])==36
# Every absent registration is covered natively and by the public unsupported harness inventory.
covered={name for c in s['cases'] for name in c['coversRegistrations']}
absent={x['name'] for x in s['registry'] if x['tsStatus']=='absent'}
assert absent<=covered
assert set(s['scope']['publicUnsupportedCoverage'])==absent
for fixture in s['scope']['publicFetchFixtures'].values(): assert (R/fixture).is_file()
# Exact upstream assertion bodies are immutable and line/hash checked.
for a in s['upstreamAssertions']:
    lines=(SRC/'test'/a['sourceTest']).read_text().splitlines(True)
    body=''.join(lines[a['lineStart']-1:a['lineEnd']])
    assert len(body.encode())==a['bodyBytes'] and hashlib.sha256(body.encode()).hexdigest()==a['bodySha256']
    assert a['assertionId'] in body
assert s['scope']['implementationBranchesBySlice']
print('ordinary scalar manifest: 48 rows, 30 cases, 48 native observations, 12 implemented/36 absent; source/flags/arities/coverage/provenance verified')
