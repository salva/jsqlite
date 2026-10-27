#!/usr/bin/env python3
"""Fresh read-only typed/metadata oracle for the ordinary 69 public attempts.

Independent native C API capture, never a runtime backend. Fixtures are checked
against the retained capture before opening; statement reset/rebind is exercised.
"""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('capture', ROOT / 'test/conformance/capture-index-planner.py')
n = importlib.util.module_from_spec(spec)
spec.loader.exec_module(n)
source = json.loads((ROOT / 'reference/sqlite/manifest.json').read_text())
retained = json.loads((ROOT / 'test/conformance/cases/stage3-index-planner.json').read_text())
library = pathlib.Path(sys.argv[1]).resolve()
d = n.load(str(library))
assert d.sqlite3_sourceid().decode() == source['sqliteSourceId'] == retained['source']['sourceId']
assert d.sqlite3_libversion().decode() == retained['source']['version']
for name in ['name', 'decltype', 'database_name', 'table_name', 'origin_name']:
    f = getattr(d, 'sqlite3_column_' + name)
    f.argtypes = [C.c_void_p, C.c_int]
    f.restype = C.c_char_p
variants = []
for variant in retained['variants']:
    fixture = ROOT / variant['fixture']['path']
    assert hashlib.sha256(fixture.read_bytes()).hexdigest() == variant['fixture']['sha256']
    db = C.c_void_p()
    assert d.sqlite3_open_v2(str(fixture).encode(), C.byref(db), 1, None) == 0
    cases = []
    try:
        for case in variant['cases']:
            st = C.c_void_p()
            assert d.sqlite3_prepare_v2(db, case['sql'].encode(), -1, C.byref(st), None) == 0, case['id']
            try:
                columns = []
                for i in range(d.sqlite3_column_count(st)):
                    column = {}
                    for key, name in [('name', 'name'), ('declaredType', 'decltype'), ('database', 'database_name'), ('table', 'table_name'), ('origin', 'origin_name')]:
                        v = getattr(d, 'sqlite3_column_' + name)(st, i)
                        column[key] = None if v is None else v.decode()
                    columns.append(column)
                runs = []
                for run in case['nativeRuns']:
                    assert d.sqlite3_clear_bindings(st) == 0
                    n.bind(d, st, run['bindings'])
                    rows = []
                    while (rc := d.sqlite3_step(st)) == 100:
                        rows.append([n.cell(d, st, i) for i in range(len(columns))])
                    assert rc == 101, (case['id'], rc)
                    assert rows == run['rows'], (variant['id'], case['id'], 'retained row mismatch')
                    runs.append({'bindings': run['bindings'], 'rows': rows})
                    assert d.sqlite3_reset(st) == 0
                cases.append({'id': case['id'], 'sql': case['sql'], 'columns': columns, 'runs': runs})
            finally:
                assert d.sqlite3_finalize(st) == 0
    finally:
        assert d.sqlite3_close(db) == 0
    variants.append({'id': variant['id'], 'fixtureSha256': variant['fixture']['sha256'], 'cases': cases})
output = {'sourceId': source['sqliteSourceId'], 'librarySha256': hashlib.sha256(library.read_bytes()).hexdigest(), 'captureSha256': hashlib.sha256((ROOT / 'test/conformance/cases/stage3-index-planner.json').read_bytes()).hexdigest(), 'variants': variants}
pathlib.Path(sys.argv[2]).write_text(json.dumps(output, indent=2) + '\n')
print(f'fresh pinned read-only typed rows/five-field metadata: {sum(len(v["cases"]) for v in variants)} cases, {len(variants)} encodings; reset/rebind; retained rows identical')
print('sourceId:', output['sourceId'])
print('librarySha256:', output['librarySha256'])
