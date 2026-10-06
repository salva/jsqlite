#!/usr/bin/env python3
"""Development-only pinned-native-first OR capture. Never imported by runtime."""
import ctypes as C, hashlib, importlib.util, json, pathlib, re, sys, struct
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
m=json.loads((ROOT/'reference/sqlite/manifest.json').read_text()); d=n.load(sys.argv[1])
assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'] and d.sqlite3_libversion().decode()==m['version']
for name in ['name','decltype','database_name','table_name','origin_name']:
 f=getattr(d,'sqlite3_column_'+name);f.argtypes=[C.c_void_p,C.c_int];f.restype=C.c_char_p
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
up=ROOT/'reference/sqlite/sqlite-src-3530400/test'
w7=(up/'where7.test').read_text();w9=(up/'where9.test').read_text()
# Literal original CREATE/INSERT/index setup, isolate namespaces, omit unrelated tables.
s7=w7[w7.index('CREATE TABLE t1('):w7.index('SELECT * FROM t1;')].replace('t1','w7')
s9=w9[w9.index('CREATE TABLE t1('):w9.index('CREATE TABLE t2(')].replace('t1','w9')
setup=s7+s9+'''CREATE TABLE test1(f1 INT,f2 INT); INSERT INTO test1 VALUES(11,22),(33,44);
CREATE TABLE o(id INTEGER PRIMARY KEY,a NUMERIC,b TEXT COLLATE NOCASE,c INTEGER,r REAL,p BLOB);
CREATE INDEX oa ON o(a DESC,c); CREATE INDEX ob ON o(b COLLATE NOCASE DESC,c); CREATE INDEX oc ON o(c);
INSERT INTO o VALUES(1,1,'Alpha',4,1.0,x'00ff'),(2,2,'beta',5,2.25,x''),(3,1,'BETA',6,3.0,x'0102'),(4,NULL,NULL,7,4.5,NULL),(5,3,'z',8,5.0,x'fe');
CREATE TABLE wr(a INTEGER PRIMARY KEY,b,c) WITHOUT ROWID; INSERT INTO wr VALUES(1,2,3),(2,3,4); CREATE INDEX wrb ON wr(b); CREATE INDEX wrc ON wr(c);
'''
cases=[]
def add(id,sql,classification='supplemental',anchor=None,selected=False,runs=None):
 cases.append(dict(id=id,sql=sql,classification=classification,anchor=anchor,selectedRequired=selected,bindingRuns=runs or [[]]))
for id in ['1.2','1.3','1.5','1.6','1.7']:
 block=re.search(r'do_test where7-'+re.escape(id)+r' \{\s*count_steps \{(.*?)\}\s*\}',w7,re.S).group(1).strip()
 add('where7-'+id,block.replace('t1','w7'),'adapted','where7.test/where7-'+id,id!='1.3')
block=re.search(r'do_test where9-1.2.1 \{\s*count_steps \{(.*?)\}\s*\}',w9,re.S).group(1).strip()
add('where9-1.2.1',block.replace('t1','w9'),'adapted','where9.test/where9-1.2.1',True)
add('select1-8.1','SELECT f1 FROM test1 WHERE 4.3+2.4 OR 1 ORDER BY f1','adapted','select1.test/select1-8.1')
for id,sql,sel in [
 ('unready-residual',"SELECT i.id,later.id FROM o AS i CROSS JOIN o AS later WHERE later.id=1 AND ((i.a=1 AND later.c=4) OR (i.b='beta' AND later.c=5)) ORDER BY i.id,later.id",True),
 ('inner-cover','SELECT i.rowid,i.a,i.c FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND ((i.a=1 AND i.c<5) OR (i.a=2 AND i.c>4)) ORDER BY i.rowid',True),
 ('common-rowid','SELECT rowid,a,c FROM o WHERE (a=1 AND c<5) OR (a=2 AND c>4) ORDER BY rowid',True),
 ('common-cover','SELECT a,c FROM o WHERE (a=1 AND c<5) OR (a=2 AND c>4) ORDER BY a,c',True),
 ('overlap','SELECT id,a,b,r,p FROM o WHERE a=1 OR b=\'beta\' ORDER BY id',True),
 ('empty','SELECT id FROM o WHERE a=900 OR b=\'absent\' ORDER BY id',True),
 ('repeated-arm','SELECT id FROM o WHERE a=1 OR b=\'beta\' OR a=1 ORDER BY id',True),
 ('and-residual','SELECT id FROM o WHERE ((a=1 AND c>4) OR b=\'beta\') AND r>2 ORDER BY id',True),
 ('range-desc','SELECT id FROM o WHERE (a>=1 AND a<2) OR (b>=\'beta\' AND b<\'z\') ORDER BY id',True),
 ('null-is','SELECT id FROM o WHERE a IS NULL OR b IS NULL ORDER BY id',True),
 ('affinity','SELECT id FROM o WHERE a=\'1\' OR b=\'BETA\' ORDER BY id',True),
 ('or-in-control','SELECT id FROM o WHERE a=1 OR a=2 ORDER BY id',False),
 ('recursive','SELECT id FROM o WHERE (a=1 OR b=\'beta\') OR c=7 ORDER BY id',True),
 ('nested-arm',"SELECT id FROM o WHERE ((a=1 OR b='beta') AND c<7) OR c=7 ORDER BY id",True),
 ('inner-or',"SELECT i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND (i.a=1 OR i.b='beta') ORDER BY i.id",True),
 ('inner-in',"SELECT i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND (i.a IN (1,2,1,NULL) OR i.b='beta') ORDER BY i.id",True),
 ('inner-in-empty',"SELECT i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND (i.a IN (900,NULL) OR i.b='beta') ORDER BY i.id",True),
 ('inner-in-composite',"SELECT i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND ((i.a IN (1,2,1,NULL) AND i.c IN (4,5,6,4,NULL)) OR i.b='beta') ORDER BY i.id",True),
 ('correlated-or',"SELECT outerrow.id,i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id<=2 AND (i.a=outerrow.a OR i.b='beta') ORDER BY outerrow.id,i.id",True),
 ('inner-or-reset',"SELECT outerrow.id,i.id FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id<=2 AND (i.a=1 OR i.b='beta') ORDER BY outerrow.id,i.id",True),
 ('wr-control','SELECT a FROM wr NOT INDEXED WHERE b=2 OR c=4 ORDER BY a',False),
 ('left-on','SELECT x.a,y.a FROM w7 x LEFT JOIN w7 y ON (y.b=x.b OR y.c=x.c) ORDER BY x.a,y.a',False),
 ('right-on','SELECT x.a,y.a FROM w7 x RIGHT JOIN w7 y ON (y.b=x.b OR y.c=x.c) ORDER BY x.a,y.a',False),
 ('full-on','SELECT x.a,y.a FROM w7 x FULL JOIN w7 y ON (y.b=x.b OR y.c=x.c) ORDER BY x.a,y.a',False),
 ('error','SELECT missing FROM o WHERE a=1 OR b=\'beta\'',False),
]:add(id,sql,selected=sel)
add('rebind','SELECT id,a,r,p FROM o WHERE a=?1 OR b=?2 ORDER BY id',selected=True,runs=[[1,'beta'],[900,'absent'],[None,None],[2.0,'BETA'],[2,'BETA']])
add('rowid-affinity',"SELECT id FROM o WHERE rowid=?1 OR b='beta' ORDER BY id",selected=True,runs=[['1'],['1.5'],[1.0],[1],[None]])

def binding_cell(value):
 if value is None:return {'type':'null'}
 if isinstance(value,int):return {'type':'integer','value':str(value)}
 if isinstance(value,float):return {'type':'real','ieee754be':struct.pack('>d',value).hex()}
 if isinstance(value,str):return {'type':'text','utf8Hex':value.encode().hex()}
 return value

def capture(db,c):
 st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,c['sql'].encode(),-1,C.byref(st),None)
 if rc: return {'error':{'phase':'prepare','code':rc,'message':d.sqlite3_errmsg(db).decode()},'runs':[]}
 metadata=[{key:(getattr(d,'sqlite3_column_'+native)(st,i) or b'').decode() or None for key,native in [('name','name'),('declaredType','decltype'),('database','database_name'),('table','table_name'),('origin','origin_name')]} for i in range(d.sqlite3_column_count(st))]
 runs=[]
 for values in c['bindingRuns']:
  assert d.sqlite3_reset(st)==0;assert d.sqlite3_clear_bindings(st)==0;n.bind(d,st,values)
  rows=[]
  while (rc:=d.sqlite3_step(st))==100:rows.append([n.cell(d,st,i) for i in range(d.sqlite3_column_count(st))])
  assert rc==101,(c['id'],rc)
  eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',c['sql'],values)
  raw,_=n.query(d,db,'EXPLAIN '+c['sql'],values)
  program=[{'opcode':n.text(r[1]),'p1':r[2],'p2':r[3],'p3':r[4],'p4':r[5]} for r in raw]
  if c['selectedRequired']:
   assert 'MULTI-INDEX OR' in eqp,(c['id'],eqp)
   assert any(op['opcode']=='RowSetTest' for op in program)
  # Independently executed storage-class discriminator, not JSON number inference.
  binding_types=[]
  if values:
   tagged,_=n.query(d,db,'SELECT '+','.join('typeof(?'+str(i+1)+')' for i in range(len(values))),values)
   binding_types=[n.text(cell) for cell in tagged[0]]
   assert binding_types==[binding_cell(value)['type'] for value in values]
  runs.append({'bindings':values,'bindingCells':[binding_cell(value) for value in values],'bindingTypes':binding_types,'rows':rows,'eqp':eqp,'program':program,'status':{'fullscan':d.sqlite3_stmt_status(st,1,1),'sort':d.sqlite3_stmt_status(st,2,1),'vm':d.sqlite3_stmt_status(st,4,1)}})
 assert d.sqlite3_finalize(st)==0
 return {'metadata':metadata,'error':None,'runs':runs}
movement='--movement-fixtures' in sys.argv
if movement:
 setup="""CREATE TABLE o(id INTEGER PRIMARY KEY,a NUMERIC,b TEXT COLLATE NOCASE,c INTEGER,r REAL,p BLOB);
 CREATE INDEX oa ON o(a DESC,c); CREATE INDEX ob ON o(b COLLATE NOCASE DESC,c); CREATE INDEX oc ON o(c);
 """
 setup+='INSERT INTO o VALUES'+','.join(f"({i},{i%7},'b{i%5}',{i},{i}.0,x'00ff')" for i in range(1,3001))+';'
 cases=[]
 add('page-movement',"SELECT id,r,p FROM o WHERE a>=2 AND a<=4 OR b='b3' ORDER BY id",selected=True)
variants=[]
for id,encoding in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 file=ROOT/f'test/fixtures/or-rowid/{id}{"-movement" if movement else ""}.db';db=C.c_void_p()
 if '--reuse-fixtures' not in sys.argv:
  file.unlink(missing_ok=True);assert d.sqlite3_open(str(file).encode(),C.byref(db))==0
  n.execsql(d,db,f"PRAGMA encoding='{encoding}';"+setup);assert d.sqlite3_close(db)==0
 assert d.sqlite3_open_v2(str(file).encode(),C.byref(db),1,None)==0
 records=[{**c,**capture(db,c)} for c in cases];assert d.sqlite3_close(db)==0
 raw=file.read_bytes();variants.append({'id':id,'encoding':encoding,'fixture':{'path':str(file.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'cases':records})
out={'source':m,'producer':'test/conformance/capture-or-rowid.py','reopenedReadOnly':True,'variants':variants,'accounting':{'cases':len(cases),'encodings':3,'nativeCaptures':len(cases)*3,'exact':0,'adapted':0 if movement else 7*3,'supplemental':len(cases)*3 if movement else (len(cases)-7)*3,'tsCredit':0}}
(ROOT/f'docs/research/card-s-f-or/{"movement-native" if movement else "native"}.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out['accounting']));print('\n'.join(str(v['fixture']) for v in variants))
