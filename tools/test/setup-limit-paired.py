#!/usr/bin/env python3
"""Original CF04/A4 33+15 records and A8 99 records, independently captured.

N-d71 drivers are relocated into setup-cases.json and setup-limit-{native,public}.
A8 uses the unchanged shared 33-case source, not reconstructed SQL. Metadata
comparison is intentionally limited to setup; A8 adds typed rows/phase/reset,
not an assertion of native five-field metadata or native/public finalize parity.
"""
import ctypes, hashlib, json, pathlib, subprocess, sys

ENCODINGS = ('utf8', 'utf16le', 'utf16be')
SETUP_IDS = ('R0', *('S'+str(i) for i in range(10)), 'false', 'true', 'distinct', 'empty', 'error')

def compare(native, public, cases):
    expected = {(e, c['id']) for e in ENCODINGS for c in cases}
    def index(records):
        assert len(records) == len(expected), 'missing/duplicate capture'
        result = {(r['enc'], r['id']): r for r in records}
        assert result.keys() == expected, 'case membership drift'
        for r in records:
            if 'phase' in r:
                assert r['phase'] == 'prepare' and r['code'] == 1 and r['error']
            else:
                assert len(r['runs']) == 2 and r['runs'][0] == r['runs'][1], 'reset drift'
        return result
    assert index(native) == index(public), 'typed/metadata/phase/reset mismatch'

def main():
    root, library, node, output = sys.argv[1:]
    root, library, output = pathlib.Path(root).resolve(), pathlib.Path(library).resolve(), pathlib.Path(output)
    here = pathlib.Path(__file__).resolve().parent
    digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    lib = ctypes.CDLL(str(library))
    lib.sqlite3_sourceid.restype = ctypes.c_char_p
    lib.sqlite3_libversion.restype = ctypes.c_char_p
    assert lib.sqlite3_sourceid().decode() == pin['sqliteSourceId'], 'SourceID mismatch'
    assert lib.sqlite3_libversion().decode() == pin['version'], 'version mismatch'
    generation = json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
    assert generation == 'g-fee22cf861600cad6529c65e4a6561aeedca2a0405e64643575b7752aa9d2fd0'
    inputs = [here/name for name in ('setup-cases.json', 'setup-limit-paired.py', 'setup-limit-native.py', 'setup-limit-public.mjs')]
    inputs += [root/'reference/sqlite/manifest.json', root/'test/fixtures/CURRENT.json',
               root/'test/conformance/limit-offset-adjudication-cases.mjs']
    fixtures = [root/f'test/fixtures/generations/{generation}/generated/{name}.db'
                for e in ENCODINGS for name in (f'subquery-{e}', 'storage-p4096'+('' if e=='utf8' else '-'+e))]
    # Original G21 fixtures, not regenerated substitutes. Authenticate before open.
    for path in fixtures:
        baseline = subprocess.check_output(['git','show','8c7883d3d1cfe657b0e33a28d3c834869181f257:'+str(path.relative_to(root))],cwd=root)
        assert hashlib.sha256(baseline).hexdigest() == digest(path), 'original fixture changed'
    inputs += fixtures
    before = {str(p.relative_to(root)): digest(p) for p in inputs}
    library_hash = digest(library)
    cases = json.loads((here/'setup-cases.json').read_text())
    assert tuple(c['id'] for c in cases) == SETUP_IDS
    limit = subprocess.check_output([node,'--input-type=module','-e',
        "import {limitCases} from './test/conformance/limit-offset-adjudication-cases.mjs';console.log(JSON.stringify(limitCases))"],cwd=root,text=True)
    limit = json.loads(limit)
    assert len(limit) == 33, 'A8 original workload membership changed'
    cases += [dict(id='A8-'+str(i), fixture='storage', sql=c['sql'], **({'bindings':c['bindings']} if 'bindings' in c else {})) for i,c in enumerate(limit)]
    captures = {}
    for name, command in [('native.json',[sys.executable,str(here/'setup-limit-native.py'),str(root),str(library)]),
                          ('public.json',[node,'--experimental-strip-types',str(here/'setup-limit-public.mjs'),str(root)])]:
        result = subprocess.run(command,input=json.dumps(cases),capture_output=True,text=True,timeout=80)
        assert result.returncode == 0, result.stdout+result.stderr
        captures[name] = result.stdout
    native = [json.loads(s) for s in captures['native.json'].splitlines()]
    profile = native.pop(0)
    assert profile == dict(version=pin['version'],sourceId=pin['sqliteSourceId'],librarySha256=library_hash)
    compare(native, [json.loads(s) for s in captures['public.json'].splitlines()], cases)
    assert before == {str(p.relative_to(root)): digest(p) for p in inputs}
    assert digest(library) == library_hash
    output.mkdir(parents=True,exist_ok=False)
    for name, text in captures.items(): (output/name).write_text(text)
    (output/'receipt.json').write_text(json.dumps(dict(profile=profile,setupPairs=48,limitPairs=99,cycles=2,
        inputs=before,captures={n:digest(output/n) for n in captures}),indent=2,sort_keys=True)+'\n')
    print('CF04/A4 33+15 and A8 99 independent typed/phase/two-reset pairs match')

if __name__ == '__main__': main()
