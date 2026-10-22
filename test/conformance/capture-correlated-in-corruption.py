#!/usr/bin/env python3
"""Pinned native correlated selected-root faults and unaffected table controls.

Reuses g52's fixture construction unchanged. Native prepare/step/reset/finalize
are captured explicitly: query() assumes success and cannot own fault cleanup.
"""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib, runpy, sys
sys.dont_write_bytecode = True
p = argparse.ArgumentParser()
p.add_argument('--library', required=True); p.add_argument('--output', required=True)
a = p.parse_args(); root = pathlib.Path(a.output); root.mkdir(parents=True, exist_ok=True)
sys.argv = [sys.argv[0], '--library', a.library, '--output', str(root/'base')]
runpy.run_path(str(pathlib.Path(__file__).with_name('capture-selected-in-r1-matrix.py')), run_name='__main__')
spec = importlib.util.spec_from_file_location('oracle', pathlib.Path(__file__).with_name('capture-index-planner.py'))
o = importlib.util.module_from_spec(spec); spec.loader.exec_module(o); d = o.load(a.library)
r = json.loads((root/'base/native.json').read_text())
def open_readonly(file):
    db = C.c_void_p(); assert d.sqlite3_open_v2(str(file).encode(), C.byref(db), 1, None) == 0
    return db
for v in r['variants']:
    original = root/'base'/v['fixture']; db = open_readonly(original)
    roots, _ = o.query(d, db, "SELECT rootpage FROM sqlite_schema WHERE name='t_ab'")
    page = int(roots[0][0]['value']); assert page > 1
    assert d.sqlite3_close(db) == 0
    raw = bytearray(original.read_bytes()); size = int.from_bytes(raw[16:18], 'big') or 65536
    # btree.c decodeFlags/btreeInitPage: zero is no valid index page type.
    raw[(page-1)*size] = 0
    file = root/(v['encoding']+'-broken.db'); file.write_bytes(raw)
    db = open_readonly(file); cases = []
    for c in v['cases']:
        if c['name'] not in ['correlated', 'left-on', 'left-where', 'or']: continue
        control = c['sql'].replace('INDEXED BY t_ab', 'NOT INDEXED')
        rows, _ = o.query(d, db, control); assert rows == c['rows']
        st = C.c_void_p()
        prepare = d.sqlite3_prepare_v2(db, c['sql'].encode(), -1, C.byref(st), None)
        assert prepare == 0, (c['name'], prepare)
        codes = []
        for _ in range(2):
            rc = d.sqlite3_step(st)
            while rc == 100: rc = d.sqlite3_step(st)
            reset = d.sqlite3_reset(st)
            assert rc == 11 and reset == 11, (c['name'], rc, reset)
            codes.append(dict(step=rc, reset=reset))
        # Reset transferred the saved failure. Re-execute before finalizing so
        # finalize's return is an actual failed-execution result, not reset OK.
        rc = d.sqlite3_step(st)
        while rc == 100: rc = d.sqlite3_step(st)
        final = d.sqlite3_finalize(st); assert rc == 11 and final == 11
        after, _ = o.query(d, db, control); assert after == rows
        cases.append(dict(name=c['name'], sql=c['sql'], control=control,
                          rows=rows, runs=codes, finalize=final))
    assert d.sqlite3_close(db) == 0
    v.update(fixture=file.name, sha256=hashlib.sha256(raw).hexdigest(),
             damagedRoot=page, cases=cases)
(root/'native.json').write_text(json.dumps(r))
