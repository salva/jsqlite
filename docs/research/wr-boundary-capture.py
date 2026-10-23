"""Additional pinned native selected-WR boundary receipts. Disposable DBs stay in card work."""
import ctypes as C,importlib.util,pathlib,sys,json,hashlib,os,base64
r=pathlib.Path(sys.argv[1]);lib=pathlib.Path(sys.argv[2]);s=importlib.util.spec_from_file_location('oracle',r/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);d=m.load(str(lib))
source=d.sqlite3_sourceid().decode();assert source==json.loads((r/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
 d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p

def capture(db,sql):
 st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None);assert rc==0,(rc,sql)
 columns=[]
 for i in range(d.sqlite3_column_count(st)):
  col={}
  for key,fn in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]:
   value=getattr(d,'sqlite3_column_'+fn)(st,i);col[key]=value.decode() if value else None
  columns.append(col)
 runs=[]
 for run in range(2):
  rows=[]
  while True:
   rc=d.sqlite3_step(st)
   if rc!=100:break
   rows.append([m.cell(d,st,i) for i in range(len(columns))])
  runs.append(dict(rows=rows,rc=rc,error=d.sqlite3_errmsg(db).decode() if rc!=101 else None,resetRc=d.sqlite3_reset(st)))
 assert runs[0]==runs[1]
 final=d.sqlite3_finalize(st)
 return dict(columns=columns,**runs[0],finalizeRc=final)

work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'wr-boundary-capture';work.mkdir(exist_ok=True)
out=dict(sourceId=source,librarySha256=hashlib.sha256(lib.read_bytes()).hexdigest(),variants=[])
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 for empty in [False,True]:
  p=work/f'{enc}-{empty}.db';p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
  m.execsql(d,db,f"PRAGMA encoding='{pragma}'; CREATE TABLE m(id INTEGER PRIMARY KEY,b REAL); CREATE TABLE wr(a COLLATE NOCASE,b,c REAL,payload,PRIMARY KEY(a DESC,b)) WITHOUT ROWID; CREATE INDEX wr_c ON wr(c);")
  if not empty:m.execsql(d,db,'INSERT INTO m VALUES(1,1),(2,2),(3,NULL),(4,1);')
  m.execsql(d,db,"INSERT INTO wr VALUES('Alpha',x'00',1,NULL),('alpha',x'01',2,x'ff'),(1,2,1,1.5),(1.5,'two',NULL,'drain'),(x'00',3,3,x'00');")
  err=C.c_char_p();nullRc=d.sqlite3_exec(db,b'INSERT INTO wr VALUES(NULL,4,4,NULL)',None,None,C.byref(err));assert nullRc==19
  d.sqlite3_close(db);raw=p.read_bytes();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
  cases=[]
  for join in ['RIGHT','FULL']:
   for mode,hint,on,where in [('unforced','','r.c=l.b',''),('forced',' INDEXED BY wr_c','r.c=l.b',''),('on','','r.c=l.b AND r.b=2',''),('where','','r.c=l.b',' WHERE r.b=2')]:
    sql=f'SELECT l.id,r.a,r.b,r.c,r.payload FROM m l NOT INDEXED {join} JOIN wr r{hint} ON {on}{where} ORDER BY r.a DESC,r.b,l.id'
    eqp=m.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());assert any('SEARCH r USING INDEX wr_c' in x for x in eqp)
    cases.append(dict(name=join.lower()+'-'+mode,sql=sql,eqp=eqp,**capture(db,sql)))
  root=int(m.query(d,db,"SELECT rootpage FROM sqlite_schema WHERE name='wr_c'")[0][0][0]['value']);d.sqlite3_close(db)
  out['variants'].append(dict(encoding=enc,empty=empty,fixtureBase64=base64.b64encode(raw).decode(),fixtureSha256=hashlib.sha256(raw).hexdigest(),nullPkRc=nullRc,cases=cases))
  if not empty:
   # Stale secondary PK: same-size text change only in wr_c's leaf page.
   # Primary is intact; NotFound must skip it rather than expose its neighbour.
   pageSize=int.from_bytes(raw[16:18],'big');offset=(root-1)*pageSize
   codec={'utf8':'utf-8','utf16le':'utf-16le','utf16be':'utf-16be'}[enc]
   stale=bytearray(raw);needle='Alpha'.encode(codec);replacement='Alphz'.encode(codec)
   at=stale.find(needle,offset,offset+pageSize);assert at>=0;stale[at:at+len(needle)]=replacement
   stalePath=work/f'{enc}-stale.db';stalePath.write_bytes(stale);assert d.sqlite3_open_v2(str(stalePath).encode(),C.byref(db),1,None)==0
   staleCases=[dict(name=c['name'],sql=c['sql'],eqp=c['eqp'],**capture(db,c['sql'])) for c in cases]
   assert all(c['rc']==101 for c in staleCases);d.sqlite3_close(db)
   out['variants'][-1]['stalePrimary']=dict(fixtureBase64=base64.b64encode(stale).decode(),fixtureSha256=hashlib.sha256(stale).hexdigest(),cases=staleCases)
   damaged=bytearray(raw);pageSize=int.from_bytes(raw[16:18],'big');offset=(root-1)*pageSize;damaged[offset]=0;bad=work/f'{enc}-bad.db';bad.write_bytes(damaged)
   assert d.sqlite3_open_v2(str(bad).encode(),C.byref(db),1,None)==0
   controls=[]
   for mode,sql in [('required',cases[1]['sql']),('limit0',cases[1]['sql']+' LIMIT 0'),('offpath','SELECT id,b FROM m NOT INDEXED ORDER BY id')]:
    result=capture(db,sql);assert result['rc']==(11 if mode=='required' else 101)
    controls.append(dict(mode=mode,sql=sql,**result))
   d.sqlite3_close(db)
   out['variants'][-1]['corruption']=dict(offset=offset,root=root,fixtureBase64=base64.b64encode(damaged).decode(),fixtureSha256=hashlib.sha256(damaged).hexdigest(),cases=controls)
print(json.dumps(out,indent=2))
