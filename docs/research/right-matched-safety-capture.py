"""Native-first selected RHS malformed controls; binds exact mutations."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib
root, out, lib, work = map(pathlib.Path, sys.argv[1:5])
three_source = '--three-source' in sys.argv[5:]
work.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('oracle', root/'test/conformance/capture-index-planner.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
d = m.load(str(lib)); source = d.sqlite3_sourceid().decode()
assert source == json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
d.sqlite3_errmsg.argtypes = [C.c_void_p]; d.sqlite3_errmsg.restype = C.c_char_p
variants = []
for enc in ['utf8', 'utf16le', 'utf16be']:
    fixture = root/'test/conformance/fixtures'/f'advanced-index-{enc}.db'
    raw = fixture.read_bytes(); db = C.c_void_p()
    assert d.sqlite3_open_v2(str(fixture).encode(), C.byref(db), 1, None) == 0
    rows, _ = m.query(d, db, "SELECT rootpage FROM sqlite_schema WHERE name='m_abc'")
    page = int(rows[0][0]['value']); d.sqlite3_close(db)
    size = int.from_bytes(raw[16:18], 'big'); size = 65536 if size == 1 else size
    offset = (page-1)*size
    assert raw[offset] in (2, 10)
    bad = bytearray(raw); bad[offset] = 0
    path = work/f'{enc}-bad.db'; path.write_bytes(bad)
    cases = []
    for join in ['RIGHT JOIN', 'FULL JOIN']:
        for hint in ['', ' INDEXED BY m_abc']:
            base = f'SELECT l.id,r.id FROM m l NOT INDEXED {join} m r{hint} ON r.a=l.a AND r.b=1'
            if three_source:
                base += ' CROSS JOIN m z NOT INDEXED WHERE z.id=1'
            for mode, sql in [('required', base), ('offpath', base+' LIMIT 0'), ('scan', base.replace('m r'+hint+' ON', 'm r NOT INDEXED ON')), ('capacity', base.replace('r.b=1', 'r.b>=1'))]:
                assert d.sqlite3_open_v2(str(fixture if mode == 'capacity' else path).encode(), C.byref(db), 1, None) == 0
                st = C.c_void_p(); assert d.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(st), None) == 0
                runs = []
                for _ in range(2):
                    values = []
                    while True:
                        rc = d.sqlite3_step(st)
                        if rc != 100: break
                        values.append([m.cell(d, st, i) for i in range(2)])
                    reset = d.sqlite3_reset(st)
                    assert rc == (11 if mode == 'required' else 101), (sql, rc, d.sqlite3_errmsg(db))
                    assert reset == (11 if rc == 11 else 0)
                    runs.append(dict(rows=values, rc=rc, reset=reset))
                assert runs[0] == runs[1]
                assert d.sqlite3_finalize(st) == 0; d.sqlite3_close(db)
                cases.append(dict(mode=mode, sql=sql, **runs[0]))
    variants.append(dict(encoding=enc, fixture=fixture.name, sha256=hashlib.sha256(raw).hexdigest(), offset=offset, original=raw[offset], corruptSha256=hashlib.sha256(bad).hexdigest(), cases=cases))
out.write_text(json.dumps(dict(sourceId=source, librarySha256=hashlib.sha256(lib.read_bytes()).hexdigest(), variants=variants), indent=2)+'\n')
print('captured', sum(len(v['cases']) for v in variants), 'malformed cases, all twice/reset', out)
