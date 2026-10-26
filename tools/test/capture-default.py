#!/usr/bin/env python3
"""Run an original DEFAULT producer in a fresh isolated checkout-shaped root."""
import argparse
import ctypes
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import importlib.util


def original_default(root, output, library):
    """G98 ALTER/no-UPDATE recipe, separate from materialized S59."""
    spec = importlib.util.spec_from_file_location('default_oracle', output/'test/conformance/capture-index-planner.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    d = m.load(str(library))
    for name in ('name', 'decltype', 'database_name', 'table_name', 'origin_name'):
        fn = getattr(d, 'sqlite3_column_'+name)
        fn.argtypes = [ctypes.c_void_p, ctypes.c_int]
        fn.restype = ctypes.c_char_p
    receipt = 'test/conformance/cases/column-default-original-native.json'
    shutil.copyfile(root/receipt, output/receipt)
    expected = json.loads((output/receipt).read_text())
    actual = json.loads((output/receipt).read_text())
    for variant in actual['variants']:
        path = output/variant['fixture']
        db = ctypes.c_void_p()
        assert d.sqlite3_open(str(path).encode(), ctypes.byref(db)) == m.OK
        try:
            assert not any(sql.upper().startswith('UPDATE ') for sql in variant['setup'])
            for sql in variant['setup']:
                m.execsql(d, db, sql)
        finally:
            assert d.sqlite3_close(db) == m.OK
        assert hashlib.sha256(path.read_bytes()).hexdigest() == variant['sha256']
        assert hashlib.sha256((root/variant['fixture']).read_bytes()).hexdigest() == variant['sha256']
        assert d.sqlite3_open_v2(str(path).encode(), ctypes.byref(db), m.SQLITE_OPEN_READONLY, None) == m.OK
        try:
            for case in variant['cases']:
                sql = case['sql']
                st = ctypes.c_void_p()
                assert d.sqlite3_prepare_v2(db, sql.encode(), -1, ctypes.byref(st), None) == m.OK
                try:
                    m.bind(d, st, case['native']['bindings'])
                    runs = []
                    for _ in range(2):
                        rows = []
                        while True:
                            rc = d.sqlite3_step(st)
                            if rc == m.ROW:
                                rows.append([m.cell(d, st, i) for i in range(d.sqlite3_column_count(st))])
                            else:
                                assert rc == m.DONE
                                break
                        runs.append(rows)
                        assert d.sqlite3_reset(st) == m.OK
                    metadata = []
                    for i in range(d.sqlite3_column_count(st)):
                        fields = {}
                        for key, name in (('name','name'), ('declaredType','decltype'), ('databaseName','database_name'), ('tableName','table_name'), ('originName','origin_name')):
                            value = getattr(d, 'sqlite3_column_'+name)(st, i)
                            fields[key] = value.decode() if value is not None else None
                        metadata.append(fields)
                finally:
                    assert d.sqlite3_finalize(st) == m.OK
                case['native'] = dict(bindings=case['native']['bindings'], rows=runs[0], resetRows=runs[1], metadata=metadata,
                                      eqp=m.explain(d, db, 'EXPLAIN QUERY PLAN ', sql, case['native']['bindings']),
                                      program=m.query(d, db, 'EXPLAIN '+sql, case['native']['bindings'])[0])
            assert [len(case['native']['rows']) for case in variant['cases']] == ([5, 5] if variant['encoding']=='UTF-8' else [3, 3])
            tenant, _ = m.query(d, db, 'SELECT k FROM t WHERE id=1')
            assert tenant == [[{'type':'text', 'utf8Hex':b'tenant'.hex()}]]
        finally:
            assert d.sqlite3_close(db) == m.OK
    (output/receipt).write_text(json.dumps(actual, indent=2)+'\n')
    assert actual == expected, 'original ALTER DEFAULT corpus mismatch'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--library', required=True, type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    parser.add_argument('--mode', required=True, choices=('baseline', 'affinity', 'branches', 'cast', 'empty', 'float', 'quoted', 'raw-token'))
    args = parser.parse_args()
    root = pathlib.Path.cwd()
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    library = args.library.resolve()
    native = ctypes.CDLL(str(library))
    native.sqlite3_sourceid.restype = ctypes.c_char_p
    native.sqlite3_libversion.restype = ctypes.c_char_p
    assert native.sqlite3_sourceid().decode() == pin['sqliteSourceId']
    assert native.sqlite3_libversion().decode() == pin['version']
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    suffix = '' if args.mode == 'baseline' else '-'+args.mode
    producer = f'test/conformance/capture-column-default{suffix}.py'
    for name in (producer, 'test/conformance/capture-index-planner.py', 'reference/sqlite/manifest.json'):
        target = output/name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root/name, target)
    for directory in ('cases', 'fixtures'):
        (output/'test/conformance'/directory).mkdir(parents=True)
    subprocess.run([sys.executable, str(output/producer), str(library)], check=True)
    receipt = f'test/conformance/cases/column-default{suffix}-native.json'
    actual = json.loads((output/receipt).read_text())
    expected = json.loads((root/receipt).read_text())
    # This field identifies the oracle binary, not SQLite behavior. Different
    # builds of the same authenticated pin may differ; retain both receipts.
    actual.pop('librarySha256')
    expected.pop('librarySha256')
    assert actual == expected, 'DEFAULT native corpus mismatch'
    for variant in actual['variants']:
        for base in (output, root):
            path = base/variant['fixture']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == variant['sha256'], str(path)
    if args.mode == 'baseline':
        original_default(root, output, library)
    print('DEFAULT original receipt and fixtures equal:', receipt)


if __name__ == '__main__':
    main()
