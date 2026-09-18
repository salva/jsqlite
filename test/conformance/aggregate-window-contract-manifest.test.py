#!/usr/bin/env python3
"""Fail-closed source identity, allocation, capture, and accounting checks."""
import hashlib,json,pathlib,re
R=pathlib.Path(__file__).resolve().parents[2]
spec=json.loads((R/'test/conformance/cases/stage3-aggregate-window.spec.json').read_text())
out=json.loads((R/'test/conformance/cases/stage3-aggregate-window.json').read_text())
man=json.loads((R/'reference/sqlite/manifest.json').read_text())
assert spec['schema']=='jsqlite-aggregate-window-contract-spec/1'
assert out['schema']=='jsqlite-aggregate-window-contract/1'
assert spec['source']['version']==man['version']=='3.53.4'
assert spec['source']['sourceId']==man['sqliteSourceId']==out['source']['sourceId']
assert spec['source']['archiveSha256']==man['sha256']==out['source']['archiveSha256']
assert hashlib.sha256((R/'reference/sqlite'/man['archive']).read_bytes()).hexdigest()==man['sha256']
assert spec['requiredCoverage']==out['requiredCoverage']
assert [x['id'] for x in spec['cases']]==[x['id'] for x in out['cases']]
assert len({x['id'] for x in spec['cases']})==44
up=[x for x in spec['cases'] if x['class']=='source-credit']
comp=[x for x in spec['cases'] if x['credit']=='no-credit-companion']
assert (len(up),len(comp))==(25,19)
assert {x['class'] for x in comp}=={'local-semantic-companion','local-safety-resource'}
# These EXCLUDE slots belong to ordinary aggregate-window execution. Fail closed
# against reallocating them to a special value built-in with dedicated state.
exclude=spec['cases'][21:25]
assert [x['sourceCase'] for x in exclude]==['2.1.3','2.2.3','2.3.3','2.4.3']
assert [re.search(r'EXCLUDE\s+(NO OTHERS|CURRENT ROW|GROUP|TIES)',x['sql'],re.I).group(1).upper() for x in exclude]==['NO OTHERS','CURRENT ROW','GROUP','TIES']
assert all(all(f+'(' in x['sql'].lower() for f in ('min','max','sum')) for x in exclude)
assert all(not re.search(r'\b(?:nth_value|first_value|last_value|lead|lag)\s*\(',x['sql'],re.I) for x in exclude)
def norm(s): return re.sub(r'\s+',' ',s).strip().rstrip(';')
for c in up:
 text=(R/'reference/sqlite/sqlite-src-3530400'/c['sourceFile']).read_text()
 m=re.search(r'(?ms)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{(.*?)^\}',text)
 assert m,c['id']; body=m.group(1)
 assert hashlib.sha256(body.encode()).hexdigest()==c['sourceBodySha256'],c['id']
 assert norm(body)==norm(c['sql']),c['id']
for name,p in spec['setupProvenance'].items():
 text=(R/'reference/sqlite/sqlite-src-3530400'/p['sourceFile']).read_text()
 m=re.search(r'(?ms)^do_execsql_test\s+'+re.escape(p['sourceCase'])+r'\s+\{(.*?)^\}',text); assert m,name
 body=m.group(1)
 assert hashlib.sha256(body.encode()).hexdigest()==p['sourceBodySha256'],name
 setup_sql=re.split(r'(?im)^\s*SELECT\b',body,maxsplit=1)[0]
 assert [norm(x) for x in setup_sql.split(';') if x.strip()]==[norm(x) for x in spec['setups'][name]],name
for c in out['cases']: assert c['ts']=={'attempted':False,'credited':False,'disposition':'unimplemented-temporary'}
assert spec['accounting']=={'declared':44,'sourceCreditDeclared':25,'companionsDeclared':19,'nativeExecutable':43,'sourceOnlyCompanions':1,'tsAttempted':0,'tsCredited':0,'tsUnattempted':44}
assert out['accounting']=={'declared':44,'upstreamDeclared':25,'companionsDeclared':19,'nativeAttempted':43,'nativePassed':43,'nativeCredited':25,'sourceOnlyCompanions':1,'tsAttempted':0,'tsCredited':0,'tsUnattempted':44,'exhaustiveClaim':False}
for owner in ['src/window.c','src/select.c','src/vdbe.c','src/vdbeaux.c','src/func.c']:
 assert (R/'reference/sqlite/sqlite-src-3530400'/owner).is_file()
print('aggregate-window contract: 44 = 25 source-credit + 19 companions; native 43/43, source-only 1; TS 0/44')
