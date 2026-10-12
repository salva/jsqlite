"""Pinned read-only generated schema/compile errors; native before public."""
import ctypes as C,importlib.util,json,pathlib,sys,hashlib,base64
spec=importlib.util.spec_from_file_location('n','test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);d=n.load(sys.argv[1]);d.sqlite3_errmsg.restype=C.c_char_p
pin=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);cases=[]
definitions=[('self','CREATE TABLE t(a,b AS(b+1))','SELECT b FROM t'),('mutual','CREATE TABLE t(a,b AS(c+1),c AS(b+1))','SELECT b FROM t'),('stored-missing','CREATE TABLE t(a,b AS(missing+1) STORED)','SELECT b FROM t'),('missing','CREATE TABLE t(a,b AS(missing+1))','SELECT b FROM t'),('aggregate','CREATE TABLE t(a,b AS(sum(a)))','SELECT b FROM t'),('syntax','CREATE TABLE t(a,b AS(a+))','SELECT b FROM t')]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for label,definition,sql in definitions:
  path=out/f'{label}-{enc}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
  setup=f"PRAGMA encoding='{enc}';CREATE TABLE t(a,b);PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='{definition}' WHERE name='t';"
  assert d.sqlite3_exec(db,setup.encode(),None,None,None)==0;assert d.sqlite3_close(db)==0
  assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
  errors=[]
  # Repeated failing prepare exposes compile BUSY cleanup; SELECT 1 after each
  # checks subsequent admission on the same connection even on malformed DDL.
  for cycle in range(2):
   st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc!=0,(label,enc,rc)
   errors.append({'code':rc,'message':d.sqlite3_errmsg(db).decode()});assert not st.value
   st=C.c_void_p();nextRc=d.sqlite3_prepare_v2(db,b'SELECT 1',-1,C.byref(st),None)
   if nextRc==0:assert d.sqlite3_step(st)==100;assert d.sqlite3_column_int64(st,0)==1;assert d.sqlite3_finalize(st)==0
   else:assert not st.value
   errors[-1]['admissionCode']=nextRc
  assert errors[0]==errors[1];assert d.sqlite3_close(db)==0
  data=path.read_bytes();cases.append(dict(label=label,encoding=enc,sql=sql,errors=errors,sha256=hashlib.sha256(data).hexdigest(),image=base64.b64encode(data).decode()))
(out/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],cases=cases),indent=2)+'\n')
print('native diagnostics',len(cases))
