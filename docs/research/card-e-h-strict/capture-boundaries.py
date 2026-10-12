"""Independent pinned STRICT boundary acquisition; run from project root."""
import ctypes as C, importlib.util, pathlib, os, json, hashlib
s=importlib.util.spec_from_file_location('oracle','test/conformance/capture-index-planner.py'); n=importlib.util.module_from_spec(s); s.loader.exec_module(n)
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'strict-boundaries'; w.mkdir(exist_ok=True)
d=n.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so')); d.sqlite3_errmsg.restype=C.c_char_p
pin=json.load(open('reference/sqlite/manifest.json')); assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
variants=[]; errors=[]
ddl="""CREATE TABLE types(a INT NOT NULL,b INTEGER,c REAL,d TEXT,e BLOB,f ANY) STRICT;
CREATE TABLE inlinepk(i INTEGER PRIMARY KEY DESC) STRICT;
CREATE TABLE tablepk(i INTEGER,PRIMARY KEY(i DESC)) STRICT;
CREATE TABLE composite(a INT,b TEXT,PRIMARY KEY(a,b)) STRICT;
CREATE TABLE wr(a INTEGER PRIMARY KEY,b ANY) STRICT, WITHOUT ROWID;
CREATE TABLE g(id INTEGER PRIMARY KEY,a ANY,r REAL,va ANY AS(a) VIRTUAL,sa ANY AS(a) STORED,vr REAL AS(r) VIRTUAL,sr REAL AS(r) STORED) STRICT;
INSERT INTO g(id,a,r) VALUES(1,'000123',7),(2,X'00ff',NULL),(3,9223372036854775807,2.5),(4,NULL,NULL);
CREATE INDEX gva ON g(va COLLATE NOCASE);
"""
queries=['SELECT a,va,sa FROM g ORDER BY id','SELECT id,a,va,sa,r,vr,sr FROM g ORDER BY id',"SELECT id,va,sa FROM g WHERE va='000123' COLLATE NOCASE ORDER BY id",'SELECT va,sa FROM g WHERE id=?']
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=w/(enc+'.db'); p.unlink(missing_ok=True); db=C.c_void_p(); assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 n.execsql(d,db,f"PRAGMA encoding='{enc}';"+ddl)
 tables={t:n.query(d,db,f'PRAGMA table_xinfo({t})')[0] for t in ['types','inlinepk','tablepk','composite','wr','g']}
 cases=[dict(sql=q,bindings=[2] if '?' in q else [],rows=n.query(d,db,q,[2] if '?' in q else ())[0]) for q in queries]
 d.sqlite3_close(db); variants.append(dict(encoding=enc,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),tables=tables,cases=cases))
 for kind,sql in [('pk-order','CREATE TABLE t(a WAT, PRIMARY KEY(absent)) STRICT'),('generated-order','CREATE TABLE t(a WAT,g ANY AS(sum(a))) STRICT'),('generated-pk','CREATE TABLE t(a WAT,g ANY AS(a) PRIMARY KEY) STRICT')]:
  p=w/f'{enc}-{kind}.db';p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
  n.execsql(d,db,f"PRAGMA encoding='{enc}';CREATE TABLE t(a INT);PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='{sql}' WHERE name='t';")
  d.sqlite3_close(db);assert d.sqlite3_open(str(p).encode(),C.byref(db))==0;st=C.c_void_p();code=d.sqlite3_prepare_v2(db,b'SELECT * FROM t',-1,C.byref(st),None);msg=d.sqlite3_errmsg(db).decode();assert code==11,(kind,code,msg);d.sqlite3_finalize(st);d.sqlite3_close(db)
  errors.append(dict(encoding=enc,kind=kind,sql=sql,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),code=code,message=msg))
pathlib.Path('docs/research/card-e-h-strict/boundaries-native.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],variants=variants,errors=errors),indent=2)+'\n')
print('Pinned acquisition: 3 images, 12 typed queries, 18 table_xinfo, 9 competing errors')
