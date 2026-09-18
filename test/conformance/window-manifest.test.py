#!/usr/bin/env python3
"""Fail-closed identity/schema/accounting checks for immutable window evidence."""
import hashlib, json, pathlib, re, sys
R=pathlib.Path(__file__).resolve().parents[2]
spec=json.loads((R/'test/conformance/cases/stage3-window.spec.json').read_text())
out=json.loads((R/'test/conformance/cases/stage3-window.json').read_text())
manifest=json.loads((R/'reference/sqlite/manifest.json').read_text())
assert spec['schema']=='jsqlite-window-evidence-spec/1'
assert out['schema']=='jsqlite-window-evidence/1'
assert spec['source']['version']==manifest['version']=='3.53.4'
assert spec['source']['versionNumber']==manifest['versionNumber']==3530400
assert spec['source']['sourceId']==manifest['sqliteSourceId']==out['source']['sourceId']
assert spec['source']['archiveSha256']==manifest['sha256']==out['source']['archiveSha256']
assert hashlib.sha256((R/'reference/sqlite'/manifest['archive']).read_bytes()).hexdigest()==manifest['sha256']
assert spec['requiredCoverage']==out['requiredCoverage']
assert len(set(c['id'] for c in spec['cases']))==len(spec['cases'])
assert [c['id'] for c in spec['cases']]==[c['id'] for c in out['cases']]
up=[c for c in spec['cases'] if c['credit']=='upstream']; companions=[c for c in spec['cases'] if c['credit']=='no-credit-companion']
assert len(up)==10 and len(companions)==19 and len(spec['cases'])==29

# Upstream credit includes inherited database state, not only SELECT text.
# Reconstruct every credited setup from its pinned setup assertion and verify the
# complete assertion-body hash. This includes t2 in post-reset_db window1-6.1,
# even though window1-6.3 reads only t1.
credited_setups={c['setup'] for c in up}
assert credited_setups==set(spec['setupProvenance'])
def norm_sql(s): return re.sub(r'\s+',' ',s).strip().rstrip(';')
for setup,p in spec['setupProvenance'].items():
 text=(R/'reference/sqlite/sqlite-src-3530400'/p['sourceFile']).read_text()
 m=re.search(r'(?ms)^do_execsql_test\s+'+re.escape(p['sourceCase'])+r'\s+\{(.*?)^\}',text)
 assert m, f"missing setup assertion: {setup}"
 body=m.group(1)
 assert hashlib.sha256(body.encode()).hexdigest()==p['sourceBodySha256'], f"setup body drift: {setup}"
 setup_sql=re.split(r'(?im)^\s*SELECT\b',body,maxsplit=1)[0]
 assert [norm_sql(x) for x in setup_sql.split(';') if x.strip()]==[norm_sql(x) for x in spec['setups'][setup]], f"setup SQL drift: {setup}"
 if p['context']=='post-reset_db':
  assert re.search(r'(?ms)^reset_db\s*\n\s*do_execsql_test\s+'+re.escape(p['sourceCase'])+r'\s+\{',text), f"reset boundary drift: {setup}"
for c in up:
 text=(R/'reference/sqlite/sqlite-src-3530400'/c['sourceFile']).read_text()
 assert re.search(r'(?m)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{',text), c['id']
 body=re.search(r'(?ms)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{(.*?)^\}',text).group(1)
 assert norm_sql(c['sql'])==norm_sql(body), f"source SQL drift: {c['id']}"
for c in out['cases']:
 assert c['ts']=={'attempted':False,'credited':False,'disposition':'unimplemented-temporary'}
assert out['accounting']=={'declared':29,'upstreamDeclared':10,'companionsDeclared':19,'nativeAttempted':28,'nativePassed':28,'nativeCredited':10,'sourceOnlyCompanions':1,'tsAttempted':0,'tsCredited':0,'tsUnattempted':29,'exhaustiveClaim':False}
owners=['src/window.c','src/func.c','src/resolve.c','src/parse.y','src/select.c','src/vdbe.c','src/vdbeapi.c','src/vdbeaux.c']
for owner in owners: assert (R/'reference/sqlite/sqlite-src-3530400'/owner).is_file()
print('window evidence: 29 declared = 10 upstream + 19 companions; native 28/28 attempted, upstream credit 10/10; TS 0 attempted, 0 credit, 29 unattempted')
