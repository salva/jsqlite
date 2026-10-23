"""Pinned matched RIGHT/FULL controls; run before consuming runtime edits."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.parent.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('oracle',root/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
lib=pathlib.Path(sys.argv[3]);d=m.load(str(lib));source=d.sqlite3_sourceid().decode();assert source==json.loads((root/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
variants=[]
for enc in ['utf8','utf16le','utf16be']:
 p=root/'test/conformance/fixtures'/f'advanced-index-{enc}.db';db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for join in ['JOIN','RIGHT JOIN','FULL JOIN']:
  for suffix in ['', ' WHERE r.id IS NULL OR r.id<0', ' WHERE l.id IS NULL', ' WHERE abs(-9223372036854775808)=0']:
   for hint in ['', ' INDEXED BY m_abc', ' NOT INDEXED']:
    sql=f'SELECT l.id AS lid,r.id AS rid,r.a,r.b,r.c FROM m l {join} m r{hint} ON r.a=l.a AND r.b=1'+suffix
    st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc==0,(sql,rc)
    n=d.sqlite3_column_count(st);cols=[]
    for i in range(n):
     row={}
     for name,key in [('name','name'),('decltype','declaredType'),('database_name','database'),('table_name','table'),('origin_name','origin')]:
      v=getattr(d,'sqlite3_column_'+name)(st,i);row[key]=v.decode() if v else None
     cols.append(row)
    runs=[]
    for _ in range(2):
     rows=[]
     while True:
      rc=d.sqlite3_step(st)
      if rc!=100:break
      rows.append([m.cell(d,st,i) for i in range(n)])
     assert rc==(1 if 'abs(' in sql else 101),(sql,rc,d.sqlite3_errmsg(db));runs.append(rows);assert d.sqlite3_reset(st)==(1 if 'abs(' in sql else 0)
    assert runs[0]==runs[1];d.sqlite3_finalize(st);cases.append(dict(sql=sql,columns=cols,rows=runs[0],rc=rc))
 d.sqlite3_close(db);variants.append(dict(encoding=enc,fixture=p.name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),cases=cases))
out.write_text(json.dumps(dict(sourceId=source,librarySha256=hashlib.sha256(lib.read_bytes()).hexdigest(),variants=variants),indent=2)+'\n')
print('captured',sum(len(v['cases']) for v in variants),'cases, all twice/reset',out)
