#!/usr/bin/env python3
"""Fail-closed pinned-source allocation and native-capture checks for special windows."""
import hashlib,json,pathlib,re
R=pathlib.Path(__file__).resolve().parents[2]
spec=json.loads((R/'test/conformance/cases/stage3-special-window.spec.json').read_text())
out=json.loads((R/'test/conformance/cases/stage3-special-window.json').read_text())
man=json.loads((R/'reference/sqlite/manifest.json').read_text())
assert spec['schema']=='jsqlite-special-window-contract-spec/1'
assert out['schema']=='jsqlite-special-window-contract/1'
assert spec['source']['sourceId']==out['source']['sourceId']==man['sqliteSourceId']
assert spec['source']['archiveSha256']==out['source']['archiveSha256']==man['sha256']
assert hashlib.sha256((R/'reference/sqlite'/man['archive']).read_bytes()).hexdigest()==man['sha256']
assert spec['requiredCoverage']==out['requiredCoverage']
assert [x['id'] for x in spec['cases']]==[x['id'] for x in out['cases']]
assert len({x['id'] for x in spec['cases']})==43
up=[x for x in spec['cases'] if x['credit']=='upstream']; comp=[x for x in spec['cases'] if x['credit']!='upstream']
assert (len(up),len(comp))==(11,32)
def norm(s): return re.sub(r'\s+',' ',s).strip().rstrip(';')
for c in up:
 text=(R/'reference/sqlite/sqlite-src-3530400'/c['sourceFile']).read_text()
 m=re.search(r'(?ms)^do_(?:execsql|catchsql)_test\s+'+re.escape(c['sourceCase'])+r'\s+\{(.*?)^\}',text); assert m,c['id']
 assert hashlib.sha256(m.group(1).encode()).hexdigest()==c['sourceBodySha256']
 assert norm(m.group(1))==norm(c['sql'])
assert {x['sourceCase'] for x in up}=={'5.1','5.2','5.3','6.3','7.1.1','7.1.6','7.1.7','7.1.8','7.2','7.3','7.4'}
assert [x['encoding'] for x in comp if x['id'] in ('utf8','utf16le','utf16be')]==['UTF-8','UTF-16le','UTF-16be']
for f in ('row_number','rank','dense_rank','percent_rank','cume_dist','ntile','lead','lag','first_value','last_value','nth_value'):
 assert any(re.search(r'\b'+f+r'\s*\(',x.get('sql',''),re.I) for x in spec['cases']),f
assert spec['accounting']=={'declared':43,'sourceCreditDeclared':11,'companionsDeclared':32,'nativeExecutable':41,'sourceOnlyCompanions':2,'tsAttempted':0,'tsCredited':0,'tsUnattempted':43}
assert out['accounting']=={'declared':43,'upstreamDeclared':11,'companionsDeclared':32,'nativeAttempted':41,'nativePassed':41,'nativeCredited':11,'sourceOnlyCompanions':2,'tsAttempted':0,'tsCredited':0,'tsUnattempted':43,'exhaustiveClaim':False}
for c in out['cases']: assert c['ts']=={'attempted':False,'credited':False,'disposition':'unimplemented-temporary'}
w=(R/'reference/sqlite/sqlite-src-3530400/src/window.c').read_text()
for line in ('WINDOWFUNCX(row_number, 0, 0)','WINDOWFUNCX(dense_rank, 0, 0)','WINDOWFUNCX(rank, 0, 0)','WINDOWFUNCALL(percent_rank, 0, 0)','WINDOWFUNCALL(cume_dist, 0, 0)','WINDOWFUNCALL(ntile, 1, 0)','WINDOWFUNCALL(last_value, 1, 0)','WINDOWFUNCALL(nth_value, 2, 0)','WINDOWFUNCALL(first_value, 1, 0)'):
 assert line in w
for f in ('lead','lag'):
 for n in (1,2,3): assert f'WINDOWFUNCNOOP({f}, {n}, 0)' in w
print('special-window contract: 43 = 11 source-credit + 32 companions; native 41/41, source-only 2; TS 0/43')
