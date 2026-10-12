"""Pinned scalar generated dependency lifetime boundaries (native first)."""
import ctypes as C,importlib.util,json,pathlib,sys,hashlib,base64
spec=importlib.util.spec_from_file_location('n','test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);d=n.load(sys.argv[1]);d.sqlite3_errmsg.restype=C.c_char_p
pin=json.load(open('reference/sqlite/manifest.json'));assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);cases=[]
queries={'joined':'SELECT x.b FROM t AS x JOIN u ON u.a=x.a','grouped':'SELECT b,count(*) FROM t GROUP BY b','correlated':'SELECT (SELECT x.b FROM t AS x WHERE x.a=u.a) FROM u'}
families={'case':'CASE WHEN a THEN {dep} ELSE 0 END','between':'{dep} BETWEEN 0 AND 10','in':'a IN ({dep},9)'}
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 for family,expr in families.items():
  for shape,sql in queries.items():
   for kind in ['self','mutual','acyclic']:
    dep='b' if kind=='self' else 'c' if kind=='mutual' else 'a'
    definition='CREATE TABLE t(a,b AS('+expr.format(dep=dep)+')'+(',c AS(b+1)' if kind=='mutual' else '')+')'
    label=f'{family}-{shape}-{kind}';path=out/f'{label}-{enc}.db';path.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
    # Persist corrupt cyclic definitions without asking native CREATE to compile them.
    setup=f"PRAGMA encoding='{enc}';CREATE TABLE t(a,b);INSERT INTO t VALUES(1,0);CREATE TABLE u(a);INSERT INTO u VALUES(1);PRAGMA writable_schema=ON;UPDATE sqlite_schema SET sql='{definition}' WHERE name='t';"
    assert d.sqlite3_exec(db,setup.encode(),None,None,None)==0;assert d.sqlite3_close(db)==0
    assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
    errors=[];rows=[]
    for attempt in range(2):
     st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
     if kind!='acyclic':
      assert rc==1,(label,rc,d.sqlite3_errmsg(db));assert not st.value
      errors.append({'code':rc,'message':d.sqlite3_errmsg(db).decode()})
     else:
      assert rc==0,(label,d.sqlite3_errmsg(db));values=[]
      while True:
       rc=d.sqlite3_step(st)
       if rc==101:break
       assert rc==100
       row=[]
       for i in range(d.sqlite3_column_count(st)):
        t=d.sqlite3_column_type(st,i);assert t in [1,5];row.append(['integer',str(d.sqlite3_column_int64(st,i))] if t==1 else ['null',None])
       values.append(row)
      if attempt==0:rows=values
      else:assert rows==values
      assert d.sqlite3_finalize(st)==0
     st=C.c_void_p();assert d.sqlite3_prepare_v2(db,b'SELECT 1',-1,C.byref(st),None)==0;assert d.sqlite3_step(st)==100;assert d.sqlite3_column_int64(st,0)==1;assert d.sqlite3_finalize(st)==0
    if errors:assert errors[0]==errors[1]
    assert d.sqlite3_close(db)==0;data=path.read_bytes();cases.append(dict(label=label,encoding=enc,kind=kind,sql=sql,errors=errors,rows=rows,sha256=hashlib.sha256(data).hexdigest(),image=base64.b64encode(data).decode()))
(out/'capture.json').write_text(json.dumps(dict(sourceId=pin['sqliteSourceId'],cases=cases),indent=2)+'\n');print('native scalar BUSY boundaries',len(cases))
