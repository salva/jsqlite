"""Pinned native-first metadata PRAGMA capture; disposable DBs stay in card work."""
import ctypes as C, json, os, pathlib
root = pathlib.Path(__file__).resolve().parents[3]
work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']) / 'pragma-table'
work.mkdir(exist_ok=True)
lib=C.CDLL(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'))
lib.sqlite3_sourceid.restype=C.c_char_p
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert lib.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
lib.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]
lib.sqlite3_exec.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_char_p)]
lib.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.POINTER(C.c_char_p)]
lib.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_name.restype=C.c_char_p
lib.sqlite3_column_text.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_text.restype=C.c_char_p
lib.sqlite3_column_int64.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_int64.restype=C.c_longlong
for name in ['sqlite3_column_count','sqlite3_step','sqlite3_reset','sqlite3_finalize','sqlite3_close']:
    getattr(lib,name).argtypes=[C.c_void_p]
lib.sqlite3_column_type.argtypes=[C.c_void_p,C.c_int]
lib.sqlite3_errmsg.argtypes=[C.c_void_p];lib.sqlite3_errmsg.restype=C.c_char_p
queries=['PRAGMA table_info(t)', 'PRAGMA table_xinfo(t)', 'PRAGMA main.table_info = "t"', "PRAGMA table_info('missing')", 'PRAGMA table_info', 'PRAGMA no_such_read_metadata', 'PRAGMA temp.table_info(t)', 'PRAGMA absent.table_info(t)', 'PRAGMA table_info(?)', 'PRAGMA table_info(t); SELECT 1', 'PRAGMA index_list(t)', 'PRAGMA index_info(ix)', 'PRAGMA index_xinfo(ix)', 'PRAGMA foreign_key_list(t)', 'PRAGMA database_list', 'PRAGMA table_info(\"q weird\")', 'PRAGMA table_xinfo(\"q weird\")', "PRAGMA table_info('w')", 'PRAGMA table_info(sqlite_schema)']
result={'sourceId':manifest['sqliteSourceId'],'encodings':[]}
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
    path=work/(encoding+'.db');path.unlink(missing_ok=True)
    db=C.c_void_p();assert lib.sqlite3_open(str(path).encode(),C.byref(db))==0
    setup=f'''PRAGMA encoding='{encoding}'; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE t(id INTEGER PRIMARY KEY, a TEXT NOT NULL DEFAULT ('X'), v INT GENERATED ALWAYS AS (length(a)) VIRTUAL, s INT GENERATED ALWAYS AS (id+1) STORED, p INT REFERENCES parent(id) ON DELETE SET NULL) STRICT; CREATE INDEX ix ON t(a COLLATE nocase DESC,p); CREATE TABLE "q weird"("dup" text DEFAULT ( 1 +  2 ), "a'quote" INT DEFAULT +3, minus INT DEFAULT -2, gen TEXT AS (dup) VIRTUAL, last BLOB DEFAULT x'00'); CREATE TABLE w(b TEXT, a INT, PRIMARY KEY(a,b)) WITHOUT ROWID;'''
    err=C.c_char_p();assert lib.sqlite3_exec(db,setup.encode(),None,None,C.byref(err))==0,err.value
    cases=[]
    for sql in queries:
        stmt=C.c_void_p();tail=C.c_char_p();sql_bytes=sql.encode();rc=lib.sqlite3_prepare_v2(db,sql_bytes,-1,C.byref(stmt),C.byref(tail))
        case={'sql':sql,'prepareCode':rc}
        if rc:case['error']=lib.sqlite3_errmsg(db).decode()
        else:
            n=lib.sqlite3_column_count(stmt);case['names']=[lib.sqlite3_column_name(stmt,i).decode() for i in range(n)]
            case['tail']=tail.value.decode() if tail.value else ''
            def rows():
                out=[]
                while True:
                    rc=lib.sqlite3_step(stmt)
                    if rc!=100: assert rc==101,rc;return out
                    row=[]
                    for i in range(n):
                        typ=lib.sqlite3_column_type(stmt,i)
                        row.append({'type':typ,'value':str(lib.sqlite3_column_int64(stmt,i)) if typ==1 else lib.sqlite3_column_text(stmt,i).decode() if typ==3 else None})
                    out.append(row)
            case['rows']=rows();assert lib.sqlite3_reset(stmt)==0;assert rows()==case['rows'];assert lib.sqlite3_finalize(stmt)==0
        cases.append(case)
    assert lib.sqlite3_close(db)==0
    result['encodings'].append({'encoding':encoding,'image':str(path),'cases':cases})
(root/'docs/research/card-e-n-pragma-red/table-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('Pinned source verified; expanded native outcomes, successful rows replayed after reset, finalized and closed.')
