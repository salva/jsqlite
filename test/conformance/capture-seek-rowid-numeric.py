"""Development-only pinned SeekRowid boundary capture; no runtime imports."""
import argparse, importlib.util, ctypes as C, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--library', required=True)
parser.add_argument('--output', type=pathlib.Path, default=ROOT/'test/conformance/cases/seek-rowid-numeric-native.json')
args = parser.parse_args()
s = importlib.util.spec_from_file_location('capture', ROOT/'test/conformance/capture-index-planner.py')
m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
d = m.load(args.library)
manifest = json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
identity = {'version': d.sqlite3_libversion().decode(), 'sqliteSourceId': d.sqlite3_sourceid().decode()}
# Imported load() only configures ctypes: enforce identity HERE, before opening any fixture.
if identity != {key: manifest[key] for key in identity}:
    raise RuntimeError(f'unpinned SQLite library: {identity}')
cap = json.loads((ROOT/'test/conformance/cases/row-width-native.json').read_text()); out = []
values = [1.0,1.5,9007199254740992.0,9223372036854775808.0,-9223372036854775808.0,'1','1.0','1.5','abc',None,'9223372036854775808','9007199254740993.0']
for v in cap['variants']:
    if v['state'] != 'before': continue
    db = C.c_void_p()
    assert d.sqlite3_open_v2(str(ROOT/v['fixture']).encode(), C.byref(db), 1, None) == 0
    try:
        for value in values:
            rows, counters = m.query(d, db, 'SELECT id,typeof(?1),?1 FROM t WHERE id=?1 LIMIT 4', [value])
            out.append(dict(encoding=v['encoding'],fixture=v['fixture'],value=value,counters=counters,rows=rows))
    finally:
        d.sqlite3_close(db)
args.output.write_text(json.dumps({'schema':'seek-rowid-numeric/1','oracle':identity,'cases':out},indent=2)+'\n')
print(f'verified pinned {identity}: {len(out)} typed boundary queries')
