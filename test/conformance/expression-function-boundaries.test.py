#!/usr/bin/env python3
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2];x=json.load(open(root/'test/conformance/cases/stage3-expression-function-boundaries.json'));s=json.load(open(root/'reference/sqlite/manifest.json'))
assert x['sourceId']==s['sqliteSourceId'] and x['credit']=='no-credit-native-harness'
assert [e['encoding'] for e in x['encodingMatrix']]==['UTF-8','UTF-16le','UTF-16be']
for e in x['encodingMatrix']:
 assert set(e['parameters'])=={'utf8','utf16le','utf16be'}
 assert all('rows' in v for v in [e['column'],*e['parameters'].values()])
assert x['lengthLimit']['outcome']['primaryCode']==18
assert x['cancellation']['phase']=='step' and x['cancellation']['primaryCode']==9 and x['cancellation']['progressCallbacks']>=1
c=x['resultCleanup']; assert c['replacementByError']['message']=='primary boom' and c['replacementByError']['eventsAfterFailureFinalize']==['call-error','result-destroy']
assert c['reset']['after']==c['reset']['before']+['result-destroy']
assert c['finalize']['after']==c['finalize']['before']+['result-destroy']
assert c['registrationClose']['after']==c['registrationClose']['before']+['registration-destroy']
print(json.dumps({'encodings':3,'parameterEncodings':3,'limit':18,'stepCancel':9,'replacementResetFinalizeCleanup':True,'registrationTeardownSeparate':True},separators=(',',':')))
