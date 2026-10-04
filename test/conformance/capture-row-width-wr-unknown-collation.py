# Development-only pinned SQLite schema ownership fixture producer.
exec(open('test/conformance/capture-row-width-unsupported-collation.py').read().split('out=[]')[0])
import hashlib
out=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 path=pathlib.Path('test/conformance/fixtures')/('row-width-wr-unknown-'+enc.lower().replace('-','')+'.db')
 if path.exists():path.unlink()
 db=P();assert L.sqlite3_open_v2(str(path).encode(),C.byref(db),6,None)==0
 sql=f"PRAGMA encoding='{enc}';CREATE TABLE q(a CHAR(100),b INTEGER,c BLOB(20),PRIMARY KEY(a COLLATE nocase DESC,b)) WITHOUT ROWID;CREATE INDEX same ON q(a COLLATE nocase);CREATE INDEX different ON q(a COLLATE binary);INSERT INTO q VALUES('A',1,x'ff');PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql=replace(sql,'nocase','custom') WHERE name IN ('q','same');"
 assert L.sqlite3_exec(db,sql.encode(),None,None,None)==0;assert L.sqlite3_close(db)==0
 out.append(dict(encoding=enc,fixture=str(path),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
print(json.dumps(dict(sourceId=L.sqlite3_sourceid().decode(),variants=out),indent=2))
