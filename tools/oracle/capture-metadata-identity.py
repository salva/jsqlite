"""Pinned pragma.c cursor identity controls. Run with pinned .so and work directory."""
import ctypes as C,json,pathlib,sys,base64,hashlib
root=pathlib.Path(__file__).resolve().parents[2]
images=json.loads((root/'docs/research/card-e-n-pragma-red/scalar-filter-native.json').read_text())
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
L=C.CDLL(sys.argv[1]);P=C.c_void_p
for n,a,r in [('sourceid',[],C.c_char_p),('open',[C.c_char_p,C.POINTER(P)],C.c_int),('close',[P],C.c_int),('exec',[P,C.c_char_p,P,P,P],C.c_int),('prepare_v2',[P,C.c_char_p,C.c_int,C.POINTER(P),P],C.c_int),('step',[P],C.c_int),('reset',[P],C.c_int),('finalize',[P],C.c_int),('column_count',[P],C.c_int),('column_type',[P,C.c_int],C.c_int),('column_int64',[P,C.c_int],C.c_int64),('column_text',[P,C.c_int],C.c_char_p)]:
 f=getattr(L,'sqlite3_'+n);f.argtypes=a;f.restype=r
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(L,'sqlite3_column_'+name);f.argtypes=[P,C.c_int];f.restype=C.c_char_p
assert L.sqlite3_sourceid().decode()==manifest['sqliteSourceId']==images['sourceId']
queries=[]
for module,arg in [('table_info',"'t'"),('table_xinfo',"'t'"),('index_list',"'t'"),('index_info',"'identity_idx'"),('index_xinfo',"'identity_idx'"),('foreign_key_list',"'identity_fk'"),('database_list','')]:
 for alias in ['rowid','_rowid_','oid']:
  for prefix in ['', 'p.']:
   queries.append(f'SELECT {prefix}{alias} FROM pragma_{module}({arg}) p')
for module,arg in [('table_info',"'t'"),('table_xinfo',"'t'"),('index_list',"'t'"),('index_info',"'identity_idx'"),('index_xinfo',"'identity_idx'"),('foreign_key_list',"'identity_fk'"),('database_list','')]:
 queries += [f'SELECT sum(p.rowid),count(*) FROM pragma_{module}({arg}) p',f'SELECT p.rowid,row_number() OVER (ORDER BY p.rowid DESC) FROM pragma_{module}({arg}) p ORDER BY p.rowid']
queries += [
 *[f"SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info('u') q ON p.cid=q.cid WHERE p.arg={arg} ORDER BY p.rowid" for arg in ["NULL","1","1.0","'t'","CAST('t' AS BLOB)","'t'||char(0)||'suffix'"]],
 "SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info('u') q ON p.cid=q.cid AND p.arg=CAST('t' AS BLOB) ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info p LEFT JOIN pragma_table_info('u') q ON p.cid=q.cid AND q.arg=CAST('u' AS BLOB) WHERE p.arg='t' ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info('u') q ON p.cid=q.cid WHERE p.arg=CAST('t' AS BLOB) AND p.arg='missing' ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info('u') q ON p.cid=q.cid WHERE p.arg=CAST('t' AS BLOB) ORDER BY p.rowid",
 "SELECT sum(p.rowid),count(*) FROM pragma_table_info('missing') p",
 "SELECT p.rowid,row_number() OVER (ORDER BY p.rowid) FROM pragma_table_info('missing') p",
 "SELECT p.rowid,row_number() OVER (ORDER BY p.rowid) FROM pragma_table_info('t') p LIMIT 1",
 "SELECT p.rowid,row_number() OVER (ORDER BY p.rowid) FROM pragma_table_info('t') p",
 "SELECT sum(p.rowid) FROM pragma_database_list p",
 "SELECT sum(p.rowid) FROM pragma_index_list('t') p",
 "SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info('u') q ON p.cid=q.cid WHERE p.arg='t' COLLATE NOCASE AND p.arg='T' COLLATE NOCASE ORDER BY p.rowid",
 "SELECT t.x,(SELECT t.nm) FROM t ORDER BY t.x",
 "SELECT t.x,(SELECT count(*)+sum(p.cid) FROM pragma_table_info(t.nm) p) FROM t ORDER BY t.x",
 "SELECT p.rowid FROM pragma_table_info('missing') p",
 "SELECT p.rowid,p.cid FROM pragma_table_info('t') p WHERE p.cid>0 ORDER BY p.rowid DESC",
 "SELECT p.rowid,count(*) FROM pragma_table_info('t') p GROUP BY p.rowid ORDER BY p.rowid",
 "SELECT t.x,p.rowid FROM t LEFT JOIN pragma_table_info(t.nm) p ON p.cid=0 ORDER BY t.x",
 "SELECT t.x,(SELECT sum(p.rowid) FROM pragma_table_info(t.nm) p) FROM t ORDER BY t.x",
 "SELECT t.x FROM t WHERE EXISTS(SELECT 1 FROM pragma_table_info(t.nm) p WHERE p.rowid=2) ORDER BY t.x",
 "SELECT p.rowid,q.rowid FROM pragma_table_info('t') p JOIN pragma_table_info('u') q ON p.cid=q.cid ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info('t') p LEFT JOIN pragma_table_info('missing') q ON p.cid=q.cid ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info('t') p JOIN pragma_table_info(p.name) q ON 1 ORDER BY p.rowid,q.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_table_info p JOIN pragma_table_info q ON p.cid=q.cid WHERE p.arg='t' AND q.arg='u' ORDER BY p.rowid",
 "SELECT p.rowid,q.rowid FROM pragma_database_list p JOIN pragma_table_info('t') q ON 1 ORDER BY q.rowid",
 "SELECT (SELECT count(*) FROM pragma_table_info('t') p WHERE p.rowid=t.rowid) FROM t",
 "SELECT t.x,(SELECT count(*) FROM pragma_table_info('t') p WHERE p.rowid=t.rowid AND p.cid>=0) FROM t ORDER BY t.x",
 "SELECT rowid,_rowid_,oid FROM identity_shadow",
 "SELECT rowid,p.rowid FROM identity_shadow s JOIN pragma_table_info('u') p ON p.cid=0",
]
work=pathlib.Path(sys.argv[2]);work.mkdir(parents=True,exist_ok=True);out={'sourceId':manifest['sqliteSourceId'],'encodings':[]}
for image in images['encodings']:
 data=base64.b64decode(image['base64']);assert hashlib.sha256(data).hexdigest()==image['sha256']
 path=work/(image['encoding']+'.sqlite');path.write_bytes(data);db=P();assert L.sqlite3_open(str(path).encode(),C.byref(db))==0
 assert L.sqlite3_exec(db,b'CREATE INDEX identity_idx ON t(x,nm); CREATE TABLE identity_fk(a REFERENCES t(x),b REFERENCES u(x)); CREATE TABLE identity_shadow(rowid TEXT,_rowid_ TEXT,oid TEXT); INSERT INTO identity_shadow VALUES(\'r\',\'u\',\'o\');',None,None,None)==0
 cases=[]
 for sql in queries:
  st=P();assert L.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,sql
  width=L.sqlite3_column_count(st);metadata=[]
  for i in range(width):
   values=[getattr(L,'sqlite3_column_'+n)(st,i) for n in ['name','decltype','database_name','table_name','origin_name']]
   metadata.append(dict(zip(['name','declaredType','database','table','origin'],[v.decode() if v is not None else None for v in values])))
  runs=[]
  for cycle in range(2):
   rows=[]
   while True:
    rc=L.sqlite3_step(st)
    if rc!=100:break
    row=[]
    for i in range(width):
     kind=L.sqlite3_column_type(st,i);assert kind in [1,3,5],(sql,kind)
     row.append({'type':kind,'value':str(L.sqlite3_column_int64(st,i)) if kind==1 else L.sqlite3_column_text(st,i).decode() if kind==3 else None})
    rows.append(row)
   assert rc==101;assert L.sqlite3_reset(st)==0;runs.append(rows)
  assert L.sqlite3_finalize(st)==0;cases.append({'sql':sql,'metadata':metadata,'runs':runs})
 assert L.sqlite3_close(db)==0;data=path.read_bytes()
 out['encodings'].append({'encoding':image['encoding'],'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode(),'cases':cases})
print(json.dumps(out,indent=2))
