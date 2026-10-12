"""Development-only exact pinned native fixture capture; outputs to card work."""
import ctypes as C, importlib.util, json, pathlib, sys, hashlib
root=pathlib.Path.cwd(); out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('native',root/'test/conformance/capture-index-planner.py'); n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
d=n.load(sys.argv[1]);pin=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
variants=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 for kind in ['trigger-minimal','trigger-realistic','generated-stored','generated-virtual','trigger-view','trigger-same-name','trigger-variable','trigger-main-read','trigger-overflow','trigger-wide']:
  path=out/f'{kind}-{encoding}.db'; path.unlink(missing_ok=True); db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
  sql=f"PRAGMA encoding='{encoding}'; CREATE TABLE audit(v TEXT);"
  if kind.startswith('trigger'):
   sql+='CREATE TABLE t(id INTEGER PRIMARY KEY,a TEXT); CREATE INDEX t_a ON t(a);'
   if kind=='trigger-main-read': sql+='CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT * FROM main.audit; END;'
   elif kind=='trigger-wide': sql+='CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT '+','.join(['1']*1900)+'; END;'
   elif kind=='trigger-overflow': sql+='CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT '+"'"+'x'*10000+"'"+'; END;'
   elif kind=='trigger-view': sql+='CREATE VIEW v AS SELECT * FROM t; CREATE TRIGGER log INSTEAD OF INSERT ON v BEGIN SELECT new.a; END;'
   elif kind=='trigger-same-name': sql+='CREATE TRIGGER t AFTER INSERT ON t BEGIN SELECT 1; END;'
   elif kind=='trigger-variable': sql+='CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT 1; END; PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql="CREATE TRIGGER log AFTER INSERT ON t WHEN ? BEGIN SELECT ?1; END" WHERE name=\'log\';'
   elif kind=='trigger-realistic': sql+="CREATE TRIGGER log AFTER UPDATE OF a ON t WHEN new.a<>old.a BEGIN INSERT INTO audit VALUES(new.a); UPDATE audit SET v=upper(v) WHERE v=old.a; END;"
   else: sql+="CREATE TRIGGER log AFTER INSERT ON t BEGIN INSERT INTO audit VALUES(new.a); END;"
   sql+="INSERT INTO t VALUES(1,'alpha'),(2,'beta');"; query='SELECT id,a FROM t ORDER BY id'
  else:
   storage='STORED' if kind.endswith('stored') else 'VIRTUAL'
   sql+=f'CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER,b INTEGER AS (a+1) {storage},z TEXT); INSERT INTO t(id,a,z) VALUES(1,4,\'tail\'),(2,NULL,\'end\');';query='SELECT id,a,b,z FROM t ORDER BY id'
  err=C.c_char_p();rc=d.sqlite3_exec(db,sql.encode(),None,None,C.byref(err));assert rc==0,(rc,err.value)
  rows,_=n.query(d,db,query);assert d.sqlite3_close(db)==0
  variants.append(dict(encoding=encoding,kind=kind,path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),sql=query,rows=rows))
(out/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],variants=variants),indent=2));print('exact pinned capture:',len(variants),'all-encoding native cases')
# Native prepare.c malformed-schema controls: preserve invalid trigger rows,
# reopen read-only so the initializer, not CREATE-time validation, owns errors.
errors=[]
d.sqlite3_errmsg.restype=C.c_char_p
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 for label,definition in [('syntax','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT; END'),('instead-table','CREATE TRIGGER log INSTEAD OF INSERT ON t BEGIN SELECT 1; END'),('cross-db','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT * FROM other.audit; END'),('nested-cross-db','CREATE TRIGGER log AFTER INSERT ON t WHEN (SELECT count(*) FROM other.audit)>0 BEGIN SELECT 1; END'),('qualified-write','CREATE TRIGGER log AFTER INSERT ON t BEGIN UPDATE main.t SET a=1; END'),('indexed-write','CREATE TRIGGER log AFTER INSERT ON t BEGIN UPDATE t NOT INDEXED SET a=1; END'),('unknown-db','CREATE TRIGGER other.log AFTER INSERT ON t BEGIN SELECT 1; END'),('main-qualified','CREATE TRIGGER main.log AFTER INSERT ON t BEGIN SELECT 1; END'),('orphan','CREATE TRIGGER log AFTER INSERT ON missing BEGIN SELECT 1; END'),('update-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN UPDATE t SET a=(SELECT a FROM setdb.t) WHERE a=(SELECT a FROM wheredb.t); END'),('select-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT (SELECT a FROM exprdb.t) FROM sourcedb.t; END'),('compound-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT * FROM leftdb.t UNION ALL SELECT * FROM rightdb.t; END'),('named-window','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT row_number() OVER w FROM t WINDOW w AS (ORDER BY (SELECT a FROM other.t)); END'),('inline-window-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT row_number() OVER (PARTITION BY (SELECT a FROM partdb.t) ORDER BY (SELECT a FROM orderdb.t)) FROM t; END'),('cte-list-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN WITH c AS (SELECT * FROM firstdb.t), d AS (SELECT * FROM seconddb.t) SELECT * FROM t; END'),('source-list-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT * FROM firstdb.t JOIN seconddb.t; END'),('on-before-next-source','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT * FROM t JOIN t AS t2 ON (SELECT a FROM ondb.t) JOIN laterdb.t; END'),('projection-before-from-subquery','CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT (SELECT a FROM exprdb.t) FROM (SELECT * FROM subdb.t); END'),('from-before-cte','CREATE TRIGGER log AFTER INSERT ON t BEGIN WITH c AS (SELECT * FROM ctedb.t) SELECT * FROM sourcedb.t; END'),('cte-before-projection','CREATE TRIGGER log AFTER INSERT ON t BEGIN WITH c AS (SELECT * FROM ctedb.t) SELECT (SELECT a FROM exprdb.t) FROM t; END'),('update-from-after-set','CREATE TRIGGER log AFTER INSERT ON t BEGIN UPDATE t SET a=(SELECT a FROM setdb.t) FROM fromdb.t; END'),('step-before-when','CREATE TRIGGER log AFTER INSERT ON t WHEN (SELECT a FROM whendb.t) BEGIN SELECT a FROM stepdb.t; END'),('upsert-chain','CREATE TRIGGER log AFTER INSERT ON t BEGIN INSERT INTO t VALUES(1) ON CONFLICT(a) DO NOTHING ON CONFLICT DO UPDATE SET a=(SELECT a FROM chaindb.t); END'),('upsert-order','CREATE TRIGGER log AFTER INSERT ON t BEGIN INSERT INTO t VALUES(1) ON CONFLICT(a) DO UPDATE SET a=(SELECT a FROM setdb.t) WHERE a=(SELECT a FROM wheredb.t); END')]:
  path=out/f'invalid-{label}-{encoding}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
  sql=f"PRAGMA encoding='{encoding}'; CREATE TABLE t(a); CREATE TRIGGER log AFTER INSERT ON t BEGIN SELECT 1; END; PRAGMA writable_schema=ON; UPDATE sqlite_schema SET sql='{definition}' WHERE name='log';"
  assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0;assert d.sqlite3_close(db)==0
  assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,b'SELECT a FROM t',-1,C.byref(st),None);assert rc==11,(label,rc)
  message=d.sqlite3_errmsg(db).decode();assert d.sqlite3_close(db)==0
  errors.append(dict(encoding=encoding,kind=label,path=str(path),code=rc,message=message,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
(out/'errors.json').write_text(json.dumps(errors,indent=2));print('native malformed trigger initialization:',len(errors),'CORRUPT controls')
