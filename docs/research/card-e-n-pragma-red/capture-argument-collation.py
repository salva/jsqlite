import ctypes as C,pathlib,os,json,importlib.util,base64,hashlib
s=importlib.util.spec_from_file_location('n','test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'pragma-argument-collation';d=n.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'));d.sqlite3_errmsg.restype=C.c_char_p
w.mkdir(parents=True,exist_ok=True)
assert d.sqlite3_sourceid().decode()==json.load(open('reference/sqlite/manifest.json'))['sqliteSourceId']
cases=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=w/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 n.execsql(d,db,f'''PRAGMA encoding='{enc}';CREATE TABLE "1"(x INT DEFAULT (+7));CREATE TABLE "+"(wrong TEXT);CREATE TABLE t(a INT,b TEXT DEFAULT 'x',PRIMARY KEY(a,b),UNIQUE(a,b),UNIQUE(a));CREATE INDEX ia ON t(a COLLATE NOCASE DESC);CREATE INDEX il ON t(a COLLATE nocase);CREATE INDEX im ON t(a COLLATE NoCaSe);CREATE TABLE inherited(a TEXT COLLATE RtRiM);CREATE INDEX ii ON inherited(a);CREATE TABLE wr(a TEXT COLLATE NoCaSe,b INT,c TEXT,PRIMARY KEY(a,b)) WITHOUT ROWID;CREATE INDEX iw ON wr(c COLLATE RTRIM);''')
 qlist=['PRAGMA table_info(+1)','PRAGMA table_info=+1','PRAGMA table_info(1)','PRAGMA table_info("1")','PRAGMA table_info(t)','PRAGMA index_list(t)','PRAGMA index_xinfo(ia)','PRAGMA database_list','PRAGMA temp.never_exists(ON)','PRAGMA database_list','PRAGMA other.never_exists=foo','PRAGMA table_info(?)','PRAGMA table_info(-1)','PRAGMA table_info(+1.0)','PRAGMA index_xinfo(il)','PRAGMA index_xinfo(im)','PRAGMA index_xinfo(ii)','PRAGMA index_xinfo(iw)','PRAGMA index_xinfo(wr)']
 for q in qlist:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None)
  if rc:cases.append(dict(encoding=enc,sql=q,code=rc,message=d.sqlite3_errmsg(db).decode()))
  else:
   rows=[]
   while d.sqlite3_step(st)==100:rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   cases.append(dict(encoding=enc,sql=q,code=0,rows=rows));d.sqlite3_finalize(st)
 d.sqlite3_close(db)
json.dump(dict(sourceId=d.sqlite3_sourceid().decode(),cases=cases),open(w/'independent-native.json','w'),indent=2)
print('fresh pinned 19 probes per encoding acquired')

r=json.load(open(w/'independent-native.json'));r['images']=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 b=(w/(enc+'.db')).read_bytes();r['images'].append(dict(encoding=enc,base64=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
pathlib.Path('docs/research/card-e-n-pragma-red/argument-collation-native.json').write_text(json.dumps(r,indent=2)+'\n')
