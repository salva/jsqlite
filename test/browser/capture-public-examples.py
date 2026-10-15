"""Development-only: capture exact demo queries using the manifest-pinned SQLite.

Usage: python3 test/browser/capture-public-examples.py --library /path/to/libsqlite3.so
Run after deliberately changing the example SQL; review and commit the capture.
No native library or capture tool is included in the runtime site.
"""
import argparse
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--library', required=True)
args = parser.parse_args()
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('capture', ROOT / 'test/conformance/capture-index-planner.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)
library = capture.load(args.library)
manifest = json.loads((ROOT / 'reference/sqlite/manifest.json').read_text())
assert library.sqlite3_sourceid().decode() == manifest['sqliteSourceId']
library.sqlite3_column_name.argtypes = [C.c_void_p, C.c_int]
library.sqlite3_column_name.restype = C.c_char_p
library.sqlite3_errmsg.argtypes = [C.c_void_p]
library.sqlite3_errmsg.restype = C.c_char_p
examples = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import { examples } from './site/examples.js'; console.log(JSON.stringify(examples))"], cwd=ROOT))
fixture = ROOT / 'examples/browser/chinook.sqlite'
db = C.c_void_p()
assert library.sqlite3_open_v2(str(fixture).encode(), C.byref(db), 1, None) == 0

def public_cell(cell):
    kind = cell['type']
    if kind == 'null': value = None
    elif kind == 'real': value = struct.unpack('>d', bytes.fromhex(cell['ieee754be']))[0]
    elif kind == 'text': value = bytes.fromhex(cell['utf8Hex']).decode()
    else: value = cell.get('value', cell.get('hex'))
    return {'type': kind, 'value': value}

cases = []
try:
    for example in examples:
        statement = C.c_void_p()
        rc = library.sqlite3_prepare_v2(db, example['sql'].encode(), -1, C.byref(statement), None)
        assert rc == 0, (example['id'], library.sqlite3_errmsg(db))
        try:
            columns = [library.sqlite3_column_name(statement, i).decode() for i in range(library.sqlite3_column_count(statement))]
            rows = []
            while (rc := library.sqlite3_step(statement)) == 100:
                rows.append([public_cell(capture.cell(library, statement, i)) for i in range(len(columns))])
            assert rc == 101, (example['id'], rc)
            assert 0 < len(rows) <= 1000, example['id']
            cases.append({'id': example['id'], 'sql': example['sql'], 'columns': columns, 'rows': rows})
        finally:
            assert library.sqlite3_finalize(statement) == 0
finally:
    assert library.sqlite3_close(db) == 0
output = {'sourceId': library.sqlite3_sourceid().decode(), 'version': library.sqlite3_libversion().decode(),
          'fixtureSha256': hashlib.sha256(fixture.read_bytes()).hexdigest(), 'cases': cases}
(ROOT / 'test/browser/public-examples-native.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'Captured {len(cases)} examples against pinned SQLite {output["version"]}')
