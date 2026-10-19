"""Pinned native-first wide adversarial matrix; no conformance credits."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib
source=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]);assert d.sqlite3_sourceid().decode()==json.loads((source/'reference/sqlite/manifest.json').read_text())['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
images=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=out/(enc+'.db');assert not p.exists();db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 m.execsql(d,db,"PRAGMA encoding='%s'"%enc)
 for sql in ["CREATE TABLE t(a,b COLLATE nocase,c,d,e,f)","CREATE TABLE u(a,b COLLATE nocase,c,d,e,f)","INSERT INTO t VALUES(NULL,'A',x'00',1,1.0,'tail'),(NULL,'a',x'00',1.0,1,'tail'),(1,'B',x'ff','1',NULL,'z'),('1','b',x'00',1,NULL,'z'),(2,'é',x'',NULL,2.0,'last')","INSERT INTO u VALUES(NULL,'a',x'00',1.0,1,'tail'),(1.0,'b',x'ff','1',NULL,'z'),(x'31','B',x'00',1,NULL,'z'),(3,'É',NULL,NULL,3,'end')"]:m.execsql(d,db,sql)
 d.sqlite3_close(db);assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 queries=[]
 for width in [4,6]:
  projection=','.join('abcdef'[:width]);left=f'SELECT {projection} FROM t';right=f'SELECT {projection} FROM u'
  for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
   queries += [f'{left} {op} {right}',f'{left} {op} {right} ORDER BY 2 DESC,1 LIMIT 3 OFFSET 1',f'{left} WHERE 0 {op} {right} ORDER BY 2,1 LIMIT 2 OFFSET 1']
  queries += [f'{left} UNION {right} UNION ALL {left} ORDER BY 2,1 LIMIT 4 OFFSET 1',f'{left} UNION ALL {right} EXCEPT {left} ORDER BY 2,1 LIMIT 2 OFFSET 1',f'{left} UNION ALL {right} UNION ALL {left} UNION ALL {right} ORDER BY 2,1 LIMIT 2 OFFSET 2']
 queries += ["SELECT a,b COLLATE binary,c,d,e,f FROM t UNION SELECT a,b,c,d,e,f FROM u ORDER BY 2,1 LIMIT 4 OFFSET 1", "SELECT a,b,c,d,e,f FROM t UNION SELECT a,b,c,d,e,f FROM u ORDER BY b COLLATE binary,a LIMIT 4 OFFSET 1"]
 cases=[]
 for q in queries:
  st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);assert rc==0,(q,d.sqlite3_errmsg(db));width=d.sqlite3_column_count(st)
  case={'sql':q,'width':width,'metadata':[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(width)],'runs':[]}
  for repeat in range(2):
   rows=[]
   while True:
    rc=d.sqlite3_step(st)
    if rc!=100:break
    rows.append([m.cell(d,st,i) for i in range(width)])
   assert rc==101;case['runs'].append({'rows':rows,'end':rc});d.sqlite3_reset(st)
  d.sqlite3_finalize(st);cases.append(case)
 d.sqlite3_close(db);images.append({'encoding':enc,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(out/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'encodings':images},indent=2)+'\n')
print('native FIRST sourceID verified:',sum(len(e['cases']) for e in images),'cases twice/reset, widths4/6, all encodings')
