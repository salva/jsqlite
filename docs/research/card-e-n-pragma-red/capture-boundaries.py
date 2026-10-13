import ctypes as C,pathlib,os,json,importlib.util,base64,hashlib
s=importlib.util.spec_from_file_location('n','test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
w=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'pragma-boundaries';d=n.load(str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'));d.sqlite3_errmsg.restype=C.c_char_p
w.mkdir(parents=True,exist_ok=True)
assert d.sqlite3_sourceid().decode()==json.load(open('reference/sqlite/manifest.json'))['sqliteSourceId']
cases=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=w/(enc+'.db');p.unlink(missing_ok=True);db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 n.execsql(d,db,f'''PRAGMA encoding='{enc}';
 CREATE TABLE duplicate(a TEXT COLLATE NOCASE,b INT,
 UNIQUE(a DESC,b),UNIQUE(a COLLATE nocase ASC,b),UNIQUE(a COLLATE BINARY,b),PRIMARY KEY(a COLLATE NOCASE,b));
 CREATE INDEX duplicate_explicit ON duplicate(a COLLATE NOCASE,b);
 CREATE TABLE duplicate_wr(a TEXT COLLATE NoCaSe,b INT,c TEXT,
 UNIQUE(a COLLATE nocase DESC,b),PRIMARY KEY(a ASC,b)) WITHOUT ROWID;
 CREATE INDEX duplicate_wr_explicit ON duplicate_wr(c);
 ''')
 qlist=['PRAGMA table_info(duplicate)','PRAGMA index_list(duplicate)','PRAGMA index_xinfo(sqlite_autoindex_duplicate_1)','PRAGMA index_xinfo(sqlite_autoindex_duplicate_2)','PRAGMA index_xinfo(sqlite_autoindex_duplicate_3)','PRAGMA index_xinfo(duplicate_explicit)','PRAGMA index_list(duplicate_wr)','PRAGMA index_xinfo(duplicate_wr)','PRAGMA index_xinfo(duplicate_wr_explicit)']
 for q in qlist:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None)
  if rc:cases.append(dict(encoding=enc,sql=q,code=rc,message=d.sqlite3_errmsg(db).decode()))
  else:
   rows=[]
   while d.sqlite3_step(st)==100:rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
   cases.append(dict(encoding=enc,sql=q,code=0,rows=rows));d.sqlite3_finalize(st)
 d.sqlite3_close(db)
json.dump(dict(sourceId=d.sqlite3_sourceid().decode(),cases=cases),open(w/'independent-native.json','w'),indent=2)
print('fresh pinned 9 probes per encoding acquired')

r=json.load(open(w/'independent-native.json'));r['images']=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 b=(w/(enc+'.db')).read_bytes();r['images'].append(dict(encoding=enc,base64=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest()))
pathlib.Path('docs/research/card-e-n-pragma-red/boundaries-native.json').write_text(json.dumps(r,indent=2)+'\n')
