#!/usr/bin/env python3
"""Native-first finite R1 typed correlated/composition receipts; no runtime oracle."""
import argparse, ctypes as C, hashlib, importlib.util, json, pathlib, sys
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('oracle', pathlib.Path(__file__).with_name('capture-index-planner.py'))
o = importlib.util.module_from_spec(spec); spec.loader.exec_module(o)
a = argparse.ArgumentParser(); a.add_argument('--library', required=True); a.add_argument('--output', required=True); args = a.parse_args()
d = o.load(args.library)
pin = json.loads((pathlib.Path(__file__).resolve().parents[2]/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode() == pin['sqliteSourceId']; assert d.sqlite3_libversion().decode() == pin['version']
for name in ['name', 'decltype', 'database_name', 'table_name', 'origin_name']:
    f = getattr(d, 'sqlite3_column_'+name); f.argtypes = [C.c_void_p, C.c_int]; f.restype = C.c_char_p
def metadata(db, sql):
    st = C.c_void_p(); assert d.sqlite3_prepare_v2(db, sql.encode(), -1, C.byref(st), None) == 0
    try:
        return [{key: (v.decode() if v else None) for key, v in [(key, getattr(d, 'sqlite3_column_'+fn)(st, i)) for key, fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]]} for i in range(d.sqlite3_column_count(st))]
    finally: assert d.sqlite3_finalize(st) == 0
setup = '''CREATE TABLE outer_t(k INTEGER);INSERT INTO outer_t VALUES(1),(2),(3),(4),(5),(6);
CREATE TABLE t(id INTEGER PRIMARY KEY,a,b,c INTEGER);CREATE INDEX t_ab ON t(a,b,c);CREATE INDEX t_c ON t(c);
INSERT INTO t VALUES(1,1,2,3),(2,1.5,'é',4),(3,'é',x'00ff',5),(4,x'00ff',1.5,6),(5,NULL,2,7),(6,9,9,8);
CREATE TABLE rhs(k INTEGER,x,y);INSERT INTO rhs VALUES(1,1,2),(1,1,2),(2,1.5,'é'),(3,'é',x'00ff'),(4,x'00ff',1.5),(5,NULL,2);
'''
select = 'SELECT o.k,t.id,t.a,t.b,t.c FROM outer_t AS o '
join = 'CROSS JOIN t INDEXED BY t_ab '
member = '(t.a,t.b) IN(SELECT x,y FROM rhs WHERE rhs.k=o.k)'
queries = [
 ('correlated', select+join+'WHERE '+member+' AND t.c>=2 AND t.c<8 ORDER BY o.k,t.id'),
 ('permuted', select+join+'WHERE (t.b,t.a) IN(SELECT y,x FROM rhs WHERE rhs.k=o.k) ORDER BY o.k,t.id'),
 ('partial', select+join+'WHERE (t.a,t.c) IN(SELECT x,3 FROM rhs WHERE rhs.k=o.k) ORDER BY o.k,t.id'),
 ('left-on', select+'LEFT JOIN t INDEXED BY t_ab ON '+member+' AND t.c>=2 ORDER BY o.k,t.id'),
 ('left-where', select+'LEFT JOIN t INDEXED BY t_ab ON '+member+' WHERE t.c>=2 ORDER BY o.k,t.id'),
 ('or', select+join+'WHERE '+member+' OR (t.a,t.b) IN(SELECT y,x FROM rhs WHERE rhs.k=o.k) ORDER BY o.k,t.id'),
 ('empty', select+join+'WHERE (t.a,t.b) IN(SELECT x,y FROM rhs WHERE rhs.k=o.k AND rhs.k=99) ORDER BY o.k,t.id'),
]
root = pathlib.Path(args.output); root.mkdir(parents=True, exist_ok=True)
variants = []
for enc in ['UTF-8', 'UTF-16le', 'UTF-16be']:
    p = root/(enc+'.db'); p.unlink(missing_ok=True); db = C.c_void_p(); assert d.sqlite3_open(str(p).encode(), C.byref(db)) == 0
    o.execsql(d, db, "PRAGMA encoding='%s'" % enc); o.execsql(d, db, setup); assert d.sqlite3_close(db) == 0
    assert d.sqlite3_open_v2(str(p).encode(), C.byref(db), 1, None) == 0
    cases = []
    for name, sql in queries:
        rows, _ = o.query(d, db, sql); ops, _ = o.query(d, db, 'EXPLAIN '+sql)
        assert any(bytes.fromhex(op[1].get('utf8Hex', '')).decode() == 'SeekGE' for op in ops), name
        if name == 'correlated':
            assert len(rows) == 4
            assert {'integer', 'real', 'text', 'blob'} <= {cell['type'] for row in rows for cell in row}
        if name == 'left-on': assert len(rows) == 6
        if name == 'left-where': assert len(rows) == 4
        if name == 'empty': assert rows == []
        cases.append(dict(name=name, sql=sql, rows=rows, ops=ops, metadata=metadata(db, sql)))
    sql = select+join+'WHERE '+member+' AND t.c>=?1 ORDER BY o.k,t.id'
    runs = []
    for value in [2, 5, None, 2]:
        rows, _ = o.query(d, db, sql.replace('?1', 'NULL' if value is None else str(value)))
        runs.append(dict(bindings=[value], rows=rows))
    cases.append(dict(name='rebind', sql=sql, metadata=metadata(db, sql), runs=runs))
    assert d.sqlite3_close(db) == 0
    variants.append(dict(encoding=enc, fixture=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), cases=cases))
(root/'native.json').write_text(json.dumps(dict(sourceid=pin['sqliteSourceId'], version=pin['version'], variants=variants)))
