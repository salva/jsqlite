#!/usr/bin/env python3
"""Fail-closed identity/schema/accounting checks for immutable window evidence."""
import json, pathlib, re, sys
R=pathlib.Path(__file__).resolve().parents[2]
spec=json.loads((R/'test/conformance/cases/stage3-window.spec.json').read_text())
out=json.loads((R/'test/conformance/cases/stage3-window.json').read_text())
manifest=json.loads((R/'reference/sqlite/manifest.json').read_text())
assert spec['schema']=='jsqlite-window-evidence-spec/1'
assert out['schema']=='jsqlite-window-evidence/1'
assert spec['source']['sourceId']==manifest['sqliteSourceId']==out['source']['sourceId']
assert spec['source']['archiveSha256']==manifest['sha256']==out['source']['archiveSha256']
assert spec['requiredCoverage']==out['requiredCoverage']
assert len(set(c['id'] for c in spec['cases']))==len(spec['cases'])
assert [c['id'] for c in spec['cases']]==[c['id'] for c in out['cases']]
up=[c for c in spec['cases'] if c['credit']=='upstream']; companions=[c for c in spec['cases'] if c['credit']=='no-credit-companion']
assert len(up)==10 and len(companions)==19 and len(spec['cases'])==29
for c in up:
 text=(R/'reference/sqlite/sqlite-src-3530400'/c['sourceFile']).read_text()
 assert re.search(r'(?m)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{',text), c['id']
 body=re.search(r'(?ms)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{(.*?)^\}',text).group(1)
 norm=lambda s: re.sub(r'\s+',' ',s).strip().rstrip(';')
 assert norm(c['sql'])==norm(body), f"source SQL drift: {c['id']}"
for c in out['cases']:
 assert c['ts']=={'attempted':False,'credited':False,'disposition':'unimplemented-temporary'}
assert out['accounting']=={'declared':29,'upstreamDeclared':10,'companionsDeclared':19,'nativeAttempted':28,'nativePassed':28,'nativeCredited':10,'sourceOnlyCompanions':1,'tsAttempted':0,'tsCredited':0,'tsUnattempted':29,'exhaustiveClaim':False}
owners=['src/window.c','src/func.c','src/resolve.c','src/parse.y','src/select.c','src/vdbe.c','src/vdbeapi.c','src/vdbeaux.c']
for owner in owners: assert (R/'reference/sqlite/sqlite-src-3530400'/owner).is_file()
print('window evidence: 29 declared = 10 upstream + 19 companions; native 28/28 attempted, upstream credit 10/10; TS 0 attempted, 0 credit, 29 unattempted')
