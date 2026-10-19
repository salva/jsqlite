"""Native-first bounded common multi-output compound design probe (not credit)."""
import ctypes as C, pathlib, json, sys, importlib.util, hashlib
source=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('capture',source/'test/conformance/capture-index-planner.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
d=m.load(sys.argv[3]); manifest=json.loads((source/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
images=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 p=out/(enc+'.db'); assert not p.exists();db=C.c_void_p();assert d.sqlite3_open(str(p).encode(),C.byref(db))==0
 m.execsql(d,db,"PRAGMA encoding='%s'"%enc)
 for q in ["CREATE TABLE t(a,b,c)","CREATE TABLE u(a,b,c)","INSERT INTO t VALUES(1,'z',x'01'),(1,'a',NULL),(2.0,'b',x'02'),(NULL,'n',x''),(1,'a',NULL)","INSERT INTO u VALUES(1.0,'a',NULL),(3,'c',x'03'),(NULL,'n',x''),(2,'b',x'02')"]:m.execsql(d,db,q)
 d.sqlite3_close(db);assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
 cases=[]
 for width in [1,2,3]:
  fields=['a AS v','b AS w','c AS z'][:width]; projection=','.join(fields)
  for op in ['UNION ALL','UNION','INTERSECT','EXCEPT']:
   for order in [('v' if width==1 else 'w,v'),('1' if width==1 else '2,1')]:
    q=f'SELECT {projection} FROM t WHERE a IS NOT NULL {op} SELECT {projection} FROM u WHERE a IS NOT NULL ORDER BY {order} LIMIT 3 OFFSET 0'
    st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);case={'sql':q,'width':width,'prepare':rc};assert rc==0,d.sqlite3_errmsg(db)
    case['metadata']=[dict(zip(['name','declaredType','database','table','origin'],[(getattr(d,'sqlite3_column_'+n)(st,i) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']])) for i in range(width)]
    case['runs']=[]
    for repeat in range(2):
     rows=[]
     while True:
      rc=d.sqlite3_step(st)
      if rc!=100:break
      rows.append([m.cell(d,st,i) for i in range(width)])
     assert rc==101;case['runs'].append({'rows':rows,'end':rc});d.sqlite3_reset(st)
    d.sqlite3_finalize(st);cases.append(case)
 d.sqlite3_close(db);images.append({'encoding':enc,'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'cases':cases})
(out/'native.json').write_text(json.dumps({'sourceId':d.sqlite3_sourceid().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[3]).read_bytes()).hexdigest(),'encodings':images},indent=2))
print('native sourceID verified; 72 cases prepared/stepped/reset; widths 1/2/3, four operators, aliases/ordinals, three encodings')
