"""Pinned native WR matched/drain comparison; output receipt only, no fixture writes."""
import ctypes as C,importlib.util,pathlib,sys,json,hashlib
r=pathlib.Path(sys.argv[1]);lib=pathlib.Path(sys.argv[2]);s=importlib.util.spec_from_file_location('oracle',r/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=m.load(str(lib))
source=d.sqlite3_sourceid().decode();assert source==json.loads((r/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
out={'sourceId':source,'librarySha256':hashlib.sha256(lib.read_bytes()).hexdigest(),'cases':[]}
for enc in ['utf8','utf16le','utf16be']:
 p=r/f'test/conformance/fixtures/advanced-index-{enc}.db';db=C.c_void_p();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 for join in ['RIGHT','FULL']:
  for name,hint,on,where in [('unforced','','r.c=l.b',''),('forced',' INDEXED BY wr_c','r.c=l.b',''),('not-indexed',' NOT INDEXED','r.c=l.b',''),('scan','','+r.c=l.b',''),('no-match','','r.c=l.b AND l.id=-1',''),('where','','r.c=l.b',' WHERE r.b=1'),('on','','r.c=l.b AND r.b=1','')]:
   sql=f'SELECT l.id,r.a,r.b FROM m l NOT INDEXED {join} JOIN wr r{hint} ON {on}{where} ORDER BY r.a,r.b,l.id'
   rows,_=m.query(d,db,sql);again,_=m.query(d,db,sql);assert rows==again
   out['cases'].append(dict(encoding=enc,name=join.lower()+'-'+name,sql=sql,fixtureSha256=hashlib.sha256(p.read_bytes()).hexdigest(),rows=rows,eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,())))
 d.sqlite3_close(db)
print(json.dumps(out,indent=2))
