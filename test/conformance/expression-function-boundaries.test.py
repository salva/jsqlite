#!/usr/bin/env python3
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];x=json.load(open(root/'test/conformance/cases/stage3-expression-function-boundaries.json'));s=json.load(open(root/'reference/sqlite/manifest.json'))
assert x['sourceId']==s['sqliteSourceId'] and x['credit']=='no-credit-native-harness'
assert [e['encoding'] for e in x['encodingMatrix']]==['UTF-8','UTF-16le','UTF-16be']
for e in x['encodingMatrix']:
 assert set(e['parameters'])=={'utf8','utf16le','utf16be'}
 assert all('rows' in v for v in [e['column'],*e['parameters'].values()])
assert x['lengthLimit']['outcome']['primaryCode']==18
assert x['cancellation']['primaryCode']==9 and x['cancellation']['progressCallbacks']>=1
assert x['functionCleanup']['message']=='primary boom' and x['functionCleanup']['eventsBeforeClose']==['call'] and x['functionCleanup']['eventsAfterClose']==['call','destroy']
print(json.dumps({'encodings':3,'parameterEncodings':3,'limit':18,'cancel':9,'cleanupOnce':True},separators=(',',':')))
