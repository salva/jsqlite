"""Pinned generated identifier regressions; development-only capture to card work."""
import ctypes as C, importlib.util, json, pathlib, sys, hashlib
root=pathlib.Path.cwd();out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('native',root/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
d=n.load(sys.argv[1]);pin=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
cases=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 for storage in ['VIRTUAL','STORED']:
  path=out/f'identifiers-{encoding}-{storage}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
  sql=f'''PRAGMA encoding='{encoding}'; CREATE TABLE t("a.b" INTEGER,"q""u" INTEGER,g INTEGER AS ("a.b"+"q""u") {storage},z TEXT); INSERT INTO t("a.b","q""u",z) VALUES(4,1,'tail'),(NULL,2,'end');'''
  err=C.c_char_p();assert d.sqlite3_exec(db,sql.encode(),None,None,C.byref(err))==0,err.value
  queries=[]
  for query in ['SELECT g FROM t','SELECT * FROM t','SELECT g+1 FROM t WHERE g=5','SELECT g FROM t ORDER BY g','SELECT g AS "r.x" FROM t ORDER BY "r.x"','SELECT "s.x".g,"s.x"."a.b" FROM t AS "s.x"','SELECT "s.x".g+"s.x"."q""u" FROM t AS "s.x" WHERE "s.x".g=5']:
   rows,_=n.query(d,db,query);queries.append(dict(sql=query,rows=rows))
  assert d.sqlite3_close(db)==0
  cases.append(dict(encoding=encoding,storage=storage,path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),queries=queries))
(out/'identifier-capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],cases=cases),indent=2));print('pinned identifier capture: 6 images, 42 queries')
