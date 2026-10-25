#!/usr/bin/env python3
"""Native-FIRST prefix-range evidence. No TS expectations or compatibility credit."""
import ctypes as C
import hashlib
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('planner', ROOT/'test/conformance/capture-index-planner.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
d = m.load(sys.argv[1])
manifest = json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
branches = '--branches' in sys.argv[2:]
assert d.sqlite3_sourceid().decode() == manifest['sqliteSourceId']
for name in ['name', 'decltype', 'database_name', 'table_name', 'origin_name']:
    fn = getattr(d, 'sqlite3_column_'+name)
    fn.argtypes = [C.c_void_p, C.c_int]
    fn.restype = C.c_char_p

def capture(db, sql, bindings):
    st = C.c_void_p()
    assert d.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(st), None) == m.OK, sql
    try:
        m.bind(d, st, bindings)
        rows = []
        while True:
            rc = d.sqlite3_step(st)
            if rc == m.ROW:
                rows.append([m.cell(d, st, i) for i in range(d.sqlite3_column_count(st))])
            else:
                assert rc == m.DONE, (sql, rc)
                break
        metadata = []
        for i in range(d.sqlite3_column_count(st)):
            fields = {}
            for key, suffix in [('name','name'), ('declaredType','decltype'), ('databaseName','database_name'), ('tableName','table_name'), ('originName','origin_name')]:
                raw = getattr(d, 'sqlite3_column_'+suffix)(st, i)
                fields[key] = raw.decode() if raw is not None else None
            metadata.append(fields)
        assert d.sqlite3_reset(st) == m.OK
        repeated = []
        while True:
            rc = d.sqlite3_step(st)
            if rc == m.ROW:
                repeated.append([m.cell(d, st, i) for i in range(d.sqlite3_column_count(st))])
            else:
                assert rc == m.DONE
                break
        assert repeated == rows
        # Retain every EXPLAIN column, including String8 p3/p5 BLOB fixups.
        program, _ = m.query(d, db, 'EXPLAIN '+sql, bindings)
        return dict(bindings=bindings, rows=rows, metadata=metadata, resetRows=repeated,
                    eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,bindings), program=program)
    finally:
        assert d.sqlite3_finalize(st) == m.OK

variants = []
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
    suffix = '-branches' if branches else ''
    fixture = ROOT/f'test/conformance/fixtures/like-prefix{suffix}-{encoding.lower()}.db'
    assert not fixture.exists(), 'refuse to replace an existing capture fixture'
    fixture.parent.mkdir(parents=True, exist_ok=True)
    db = C.c_void_p()
    assert d.sqlite3_open(str(fixture).encode(), C.byref(db)) == m.OK
    setup = [f"PRAGMA encoding='{encoding}'", 'CREATE TABLE t(id INTEGER PRIMARY KEY,a TEXT,n NUMERIC,v)',
             'CREATE INDEX i_nc ON t(a COLLATE NOCASE)', 'CREATE INDEX i_bin ON t(a COLLATE BINARY)',
             'CREATE INDEX i_num ON t(n)',
             "INSERT INTO t VALUES(1,'abc',12,1),(2,'Abcd',13,1.5),(3,'abcz',14,NULL),(4,'ab_c',15,x'00ff'),(5,'ab%c',16,'text'),(6,'abd',17,NULL),(7,NULL,18,NULL),(8,x'616263',19,2),(9,x'41626364',20,3),(10,'éclair',21,4),(11,'12abc','12abc',5),(12,'-abc','-abc',6)",
             "WITH RECURSIVE x(i) AS (VALUES(20) UNION ALL SELECT i+1 FROM x WHERE i<519) INSERT INTO t SELECT i,printf('zz%04d',i),i,NULL FROM x",
             'ANALYZE']
    if branches:
        setup[-1:-1] = ['CREATE INDEX i_nc_desc ON t(a COLLATE NOCASE DESC)',
                       'CREATE INDEX i_bin_desc ON t(a COLLATE BINARY DESC)',
                       "INSERT INTO t VALUES(520,'qrs',1,1.5),(521,x'78797a',2,NULL)"]
    try:
        for sql in setup:
            m.execsql(d, db, sql)
    finally:
        assert d.sqlite3_close(db) == m.OK
    assert d.sqlite3_open_v2(str(fixture).encode(), C.byref(db), m.SQLITE_OPEN_READONLY, None) == m.OK
    cases = []
    try:
        for mode, index, pattern in [('LIKE','i_nc','abc%'),('GLOB','i_bin','abc*')]:
            for control in ['', ' INDEXED BY '+index, ' NOT INDEXED']:
                sql = f"SELECT id,a,n,v FROM t{control} WHERE a {mode} '{pattern}' ORDER BY id"
                cases.append(dict(dimension='prefix'+control, mode=mode, sql=sql, native=capture(db,sql,[])))
        for label, predicate in [('escape',"a LIKE 'ab!_%' ESCAPE '!'"), ('incomplete',"a LIKE 'ab_c%'"), ('no-prefix',"a LIKE '%abc'"), ('mismatch',"a GLOB 'abc*'"), ('numeric',"n LIKE '12%'"), ('nonnumeric',"n GLOB '-a*'"), ('unicode',"a LIKE 'é%'"), ('outer',"y.a LIKE 'abc%' AND y.id=x.id")]:
            sql = ("SELECT x.id,y.id,y.a FROM t x LEFT JOIN t y ON "+predicate+" WHERE x.id IN(1,6,8) ORDER BY x.id,y.id") if label=='outer' else f"SELECT id,a,n,v FROM t{' INDEXED BY i_nc' if label=='mismatch' else ''} WHERE {predicate} ORDER BY id"
            cases.append(dict(dimension=label, sql=sql, native=capture(db,sql,[])))
        sql = 'SELECT id,a,n,v FROM t WHERE a LIKE ? ORDER BY id'
        cases.append(dict(dimension='bound-patterns',sql=sql,runs=[capture(db,sql,[p]) for p in ['abc%','ab!_%','%abc','é%',None]]))
        if branches:
            cases = []
            for mode, index, collation, wildcard in [('LIKE','i_nc','NOCASE','%'),('GLOB','i_bin','BINARY','*')]:
                for desc in [False, True]:
                    for reverse in [False, True]:
                        for prefix in ['abc','qrs','xyz','qqq']:
                            selected = index + ('_desc' if desc else '')
                            sql = f"SELECT id,a,n,v FROM t INDEXED BY {selected} WHERE a {mode} '{prefix}{wildcard}' ORDER BY a COLLATE {collation} {'DESC' if reverse else 'ASC'}"
                            cases.append(dict(dimension='branches',mode=mode,descending=desc,reverse=reverse,prefix=prefix,sql=sql,native=capture(db,sql,[])))
    finally:
        assert d.sqlite3_close(db) == m.OK
    variants.append(dict(encoding=encoding,fixture=str(fixture.relative_to(ROOT)),sha256=hashlib.sha256(fixture.read_bytes()).hexdigest(),setup=setup,cases=cases))
result = dict(source=manifest,producer='test/conformance/capture-like-prefix.py',readOnlyCapture=True,
              tsCredit=False,limitations=['bound-pattern runs are independent prepares, not a same-statement rebind/clear receipt','TS public execution and cleanup not yet tested'],variants=variants)
out = ROOT/f'test/conformance/cases/like-prefix{suffix}-native.json'
assert not out.exists(), 'refuse to replace an existing capture receipt'
out.write_text(json.dumps(result,indent=2)+'\n')
for v in variants:
    print(v['encoding'],v['sha256'],len(v['cases']))
    for c in v['cases'][:6]:
        print(c['mode'],c['dimension'],c['native']['eqp'],len(c['native']['rows']))
