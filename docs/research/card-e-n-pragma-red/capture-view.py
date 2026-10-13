"""Pinned native-first metadata PRAGMA capture; disposable DBs stay in card work."""
import ctypes as C, json, os, pathlib
root = pathlib.Path(__file__).resolve().parents[3]
work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']) / 'pragma-view-red'
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
queries=['PRAGMA table_info(v)', 'PRAGMA table_xinfo(v)', 'PRAGMA table_info(explicit)', 'PRAGMA table_info(nested)', 'PRAGMA table_info(cycle)', 'PRAGMA table_info(missing)', 'PRAGMA table_info(dup)', 'PRAGMA table_xinfo(expr)', 'PRAGMA main.table_info("q view")', 'PRAGMA table_info(badarity)', 'PRAGMA table_info(badsource)', 'PRAGMA temp.table_info(v)', 'PRAGMA absent.table_info(v)', 'PRAGMA table_info(v); SELECT 7', 'PRAGMA table_xinfo(blobview)', 'PRAGMA table_xinfo(blobnested)', 'PRAGMA table_info(noaffnested)']
result={'sourceId':manifest['sqliteSourceId'],'encodings':[]}
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
    path=work/(encoding+'.db');path.unlink(missing_ok=True)
    db=C.c_void_p();assert lib.sqlite3_open(str(path).encode(),C.byref(db))==0
    setup=f'''PRAGMA encoding='{encoding}'; CREATE TABLE parent(id INTEGER PRIMARY KEY); CREATE TABLE t(id INTEGER PRIMARY KEY, a TEXT NOT NULL DEFAULT ('X'), v INT GENERATED ALWAYS AS (length(a)) VIRTUAL, s INT GENERATED ALWAYS AS (id+1) STORED, p INT REFERENCES parent(id) ON DELETE SET NULL) STRICT; CREATE VIEW v AS SELECT id,a,v,s,id+1 AS expr,NULL AS nil FROM t; CREATE VIEW explicit("quoted a",b) AS SELECT a,a FROM t; CREATE VIEW nested AS SELECT * FROM v; CREATE VIEW cycle AS SELECT * FROM cycle; CREATE VIEW dup AS SELECT a,a,id AS a FROM t; CREATE VIEW expr AS SELECT CAST(id AS TEXT) AS casted, id+1 AS plus, NULL AS nil, 'x' AS lit FROM t; CREATE VIEW "q view"("q col") AS SELECT s FROM t; CREATE VIEW badarity(x,y) AS SELECT id FROM t; CREATE VIEW badsource AS SELECT z FROM t; CREATE VIEW blobview AS SELECT CAST(a AS BLOB) AS b, NULL AS n FROM t; CREATE VIEW blobnested AS SELECT * FROM blobview; CREATE VIEW noaffnested AS SELECT * FROM expr;'''
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
    result['encodings'].append({'encoding':encoding,'image':str(path),'base64':__import__('base64').b64encode(path.read_bytes()).decode(),'sha256':__import__('hashlib').sha256(path.read_bytes()).hexdigest(),'cases':cases})
(root/'docs/research/card-e-n-pragma-red/view-native.json').write_text(json.dumps(result,indent=2)+'\n')
print('Pinned source verified; 51 native prepare outcomes, successful rows replayed after reset, finalized and closed.')
