#!/usr/bin/env python3
import json, pathlib, re
root=pathlib.Path(__file__).resolve().parents[2]
p=root/'test/conformance/cases/stage3-first-select.json'
m=json.loads(p.read_text())
source=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert m['sourceId']==source['sqliteSourceId']
assert m['accounting']['additiveTo']=='stage2-initial.json:38 upstream + 9 no-credit companions'
assert m['accounting']['tsCredit']==8 and m['accounting']['nativeExpectationsSeparateFromTsCredit']
old=json.loads((root/'test/conformance/cases/stage2-initial.json').read_text())
assert (len(old['upstreamCases']),len(old['companionCases']))==(38,9)
refs=[]
for c in m['cases']:
 assert c['ref'] not in refs; refs.append(c['ref'])
 assert c['occurrence']>=1 and c['native']['rows'] is not None
 assert c['operations'][0:2]==['openFixture','prepare']
 assert c['ts']=={'disposition':'implemented','attempted':{'index':len(c['operations'])-1,'op':'finalize'},'unattempted':[],'credit':True}
 file,case=c['ref'].split(':',1); text=(root/'reference/sqlite/sqlite-src-3530400'/file).read_text(errors='replace')
 assert text.count(c['sourceAssertionAnchor'])==1, c['ref']
 assert all(text.find(a)>=0 and text.find(a)<text.find(c['sourceAssertionAnchor']) for a in c['sourceSetupAnchors']), c['ref']
 assert not re.search(r'\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b',c['sql'],re.I)
for c in m['companions']:
 assert c['credit'].startswith('no-credit-')
 assert c['operations'][0].startswith('open') and c['ts']['attempted']=={'index':1,'op':c['operations'][1]}
 assert c['ts']['unattempted']==c['operations'][2:] and c['ts']['credit'] is False
 assert c.get('expected') and (c.get('sql') or c.get('inputs'))
assert m['unattemptedBreadth']
print(f"first-select manifest: {len(m['cases'])} literal upstream assertions, {len(m['companions'])} no-credit companions; TS credit 8; Stage 2 preserved 38+9")
