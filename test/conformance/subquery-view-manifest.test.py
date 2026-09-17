#!/usr/bin/env python3
"""Validate the frozen native-only subquery/view architecture gate."""
import argparse,ctypes as C,json,pathlib,re,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]; sha=lambda b:hashlib.sha256(b).hexdigest()
args=argparse.ArgumentParser(); args.add_argument('--library',required=True,help='pinned SQLite oracle shared library'); cli=args.parse_args()
spec=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.spec.json')); out=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view.json')); comp=json.load(open(ROOT/'test/conformance/cases/stage3-subquery-view-companions.spec.json')); manifest=json.load(open(ROOT/'reference/sqlite/manifest.json'))
assert spec['source']['version']==manifest['version']=='3.53.4' and spec['source']['sourceId']==manifest['sqliteSourceId']
assert out['source']==spec['source'] and out['disposition']==spec['disposition']; n=len(spec['cases']); assert n==len(out['cases'])==46 and len({c['id'] for c in spec['cases']})==n
assert out['accounting']=={'declared':n,'nativeCaptured':n,'tsAttempted':19,'tsCredited':19} and 'allocated FROM-derived/view tranche credits 19' in spec['disposition']
current=json.load(open(ROOT/'test/fixtures/CURRENT.json')); assert out['fixtureGeneration']==current['generationId']; cat=json.load(open(ROOT/'test/fixtures/generations'/out['fixtureGeneration']/'catalog.json')); fixtures={f['id']:f for f in cat['semantic']['fixtures']}; by_id={c['id']:c for c in out['cases']}
for c in spec['cases']:
 o=by_id[c['id']]; f=fixtures[c['fixture']]; path=ROOT/'test/fixtures/generations'/out['fixtureGeneration']/f['path']; assert o['fixtureSha256']==f['sha256']==sha(path.read_bytes())
 prepare=o['native']['prepare']['kind']; assert prepare==('error' if c.get('expectedPrepareError') else 'ok'),c['id']
 if prepare=='ok':
  first=o['native']['first']
  if c['id']=='aggregate30-sum-int64-overflow': assert first['kind']=='error' and first['error']['phase']=='step'
  else: assert first['kind']=='done',c['id']
 p=c['provenance']; assert p['classification'] in {'exact-translation','adapted-discriminator'} and p['rationale']; src=ROOT/p['implementingSource']['path']; raw=src.read_bytes(); assert sha(raw)==p['implementingSource']['sha256']; text=raw.decode(errors='replace'); assert all(m in text for m in p['implementingSource']['markers'])
 for e in p['evidence']:
  ep=ROOT/e['path']
  if e['kind']=='project-case':
   data=json.load(open(ep)); item=next(v for v in data['cases'] if v['id']==e['caseId']); assert sha(json.dumps(item,sort_keys=True,separators=(',',':')).encode())==e['sha256']
  else:
   s=ep.read_text(errors='replace'); prefix=ep.stem; label=e['assertion']; pat=re.compile(r'(?m)^\s*do_(?:execsql_|catchsql_)?test\s+(?:'+re.escape(prefix)+r'-)?'+re.escape(label)+r'\s*\{'); m=pat.search(s); assert m
   nxt=re.search(r'(?m)^\s*do_(?:execsql_|catchsql_)?test\s+',s[m.end():]); end=m.end()+nxt.start() if nxt else len(s); assert sha(s[m.start():end].rstrip().encode())==e['sha256'] and e['startLine']==s.count('\n',0,m.start())+1
assert {c['atomicGate'] for c in spec['cases'] if c.get('atomicGate')}=={'cte','recursive-cte','window'}
assert len([c for c in spec['cases'] if c['id'].startswith('aggregate30-')])==4
assert comp['accounting']=={'declared':15,'tsAttempted':0,'tsCredited':0} and len(comp['cases'])==15 and len({c['id'] for c in comp['cases']})==15 and 'zero credit' in comp['disposition']
required={'nesting-prepare-atomic','coroutine-suspend-resume','coroutine-cancel-inner','coroutine-deadline-inner','coroutine-work-inner','materialized-private-growth','in-set-private-growth','overlap-private-budget','reset-before-first-step','reset-after-suspension','rebind-correlated','finalize-suspended','first-error-cleanup','deferred-close-suspended','error-restores-admission'}; assert {c['id'] for c in comp['cases']}==required
print(f'subquery/view manifest: {n} native captures, 19 allocated TypeScript credits, 15 frozen companion specifications; hashed provenance valid')

# Closed companion schema: exact case objects are hashed so operations,
# expectations, limits and route-specific observations cannot degrade to prose.
# Intentional contract changes require review plus an explicit hash update here.
companion_hashes={
'nesting-prepare-atomic':'d69dcb8b540616796e5a10ceec4cc56d9d839595326b2f0b3cb685a201c63391',
'coroutine-suspend-resume':'903ea6089447bc0647b232b3ff86432df13629ce475756e0ab05388f707cd288',
'coroutine-cancel-inner':'e4b1e3edb3fe0852ddef716d3df6a1ae3db43dcf0f5d02a17da1a4ef4f09b39c',
'coroutine-deadline-inner':'6be2b5dee7a655af8c3baf12b35ef3938696072d91396533e5969b21ba0ff986',
'coroutine-work-inner':'302770afa5e60831f06c8d275fc4058bae7850781e6f7211946db32b255c7a49',
'materialized-private-growth':'60d1a474a91287a4e9b707503f88793861bf43630b5d21e3212b2ee677a07107',
'in-set-private-growth':'343a120ea81a501e646684b0b5c4613c6162b805f78820e55f0c9c813a340933',
'overlap-private-budget':'ee2504283111afa13e59c400ab219b06ecce0896c0984e46796937405f84c16b',
'reset-before-first-step':'ae4046401451907bc6608fb524a9ddfeaecadf7947b259622ab55f569cf5fd63',
'reset-after-suspension':'5abe57f24da5bb93d5e41571f8c6e832c432722cfe8c576384ac76e874f3ee4c',
'rebind-correlated':'6af4981912373386b3624dd90b235463d4836e32cc019c74436c8ae33047077c',
'finalize-suspended':'392d9d0d81ead84269fa1617226bf7835a85f1d64bc78632de813539611a699b',
'first-error-cleanup':'e99d66f4cc61365e6224de9c8dd2f9856cf0cf171da890a6e2039f820cc575d3',
'deferred-close-suspended':'b4811dea3e51944ef06d05fd82b79ddf298a631c1fdd2d7b884a082254198bf4',
'error-restores-admission':'653a658330b810183e149eabf03237aa76e732d99f528045b1b776f490370316'}
assert set(companion_hashes)=={c['id'] for c in comp['cases']}
for c in comp['cases']:
 assert set(c)>={'id','route','sql','operations','expect'} and isinstance(c['sql'],str) and c['sql'].strip()
 assert isinstance(c['operations'],list) and c['operations'] and all(isinstance(v,str) and v for v in c['operations'])
 assert isinstance(c['expect'],dict) and c['expect']
 encoded=json.dumps(c,sort_keys=True,separators=(',',':'))
 assert '...' not in encoded and '-or-' not in encoded
 assert sha(encoded.encode())==companion_hashes[c['id']],c['id']
assert next(c for c in comp['cases'] if c['id']=='finalize-suspended')['expect']['secondFinalize']=='misuse'
# All declared SQL is literal and accepted for prepare by the pinned oracle.
# This is a syntax/schema check only: unsupported TS routes remain 0/0.
fixture=ROOT/'test/fixtures/generations'/current['generationId']/fixtures['subquery-utf8']['path']
lib=C.CDLL(cli.library); P=C.c_void_p
lib.sqlite3_libversion.restype=lib.sqlite3_sourceid.restype=C.c_char_p
lib.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p]
lib.sqlite3_prepare_v2.argtypes=[P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)]
lib.sqlite3_errmsg.restype=C.c_char_p
identity=(lib.sqlite3_libversion().decode(),lib.sqlite3_sourceid().decode())
assert identity==(manifest['version'],manifest['sqliteSourceId']),identity
db=P(); assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
try:
 for c in comp['cases']:
  stmt=P(); tail=C.c_char_p(); raw=('EXPLAIN '+c['sql']).encode()
  rc=lib.sqlite3_prepare_v2(db,raw,len(raw),C.byref(stmt),C.byref(tail))
  try: assert rc==0,(c['id'],rc,lib.sqlite3_errmsg(db).decode())
  finally:
   if stmt: assert lib.sqlite3_finalize(stmt)==0
finally: assert lib.sqlite3_close(db)==0
print(f'closed companion schema: pinned {identity[0]} ({identity[1]}) prepared 15 literal SQL cases; exact operations/expectations valid')
