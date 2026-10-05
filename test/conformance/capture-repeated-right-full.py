#!/usr/bin/env python3
"""Development-only native-FIRST supplemental corpus. Never used by runtime."""
import argparse,ctypes as C,hashlib,importlib.util,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
guard_spec=importlib.util.spec_from_file_location('repeated_inputs',root/'test/conformance/repeated-capture-inputs.py')
guard=importlib.util.module_from_spec(guard_spec);guard_spec.loader.exec_module(guard)
guard.preflight(root,['cases/repeated-right-full.json', 'fixtures/repeated-right-full-utf8.db', 'fixtures/repeated-right-full-utf16le.db', 'fixtures/repeated-right-full-utf16be.db'])
spec=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-multisource-select.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
ap=argparse.ArgumentParser();ap.add_argument('--library',required=True);a=ap.parse_args()
d=h.load(a.library);manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId'];assert d.sqlite3_libversion().decode()==manifest['version']
setup=[
'CREATE TABLE a(k INTEGER,v);','CREATE TABLE b(k INTEGER,v);','CREATE TABLE c(k INTEGER,v);','CREATE TABLE e(k INTEGER,v);','CREATE TABLE wr(k INTEGER PRIMARY KEY,v) WITHOUT ROWID;',
"INSERT INTO a VALUES(1,9223372036854775807),(1,1.25),(2,'é'),(NULL,x'00ff');",
"INSERT INTO b VALUES(1,x''),(3,'中'),(NULL,2.5);",
"INSERT INTO c VALUES(1,-9223372036854775808),(3,3.0),(4,x'00ff'),(NULL,NULL);",
'INSERT INTO wr VALUES(1,1);','CREATE INDEX c_k ON c(k);']
cases=[]
def add(id,sql,tags,**kw):cases.append(dict(id=id,sql=sql,tags=tags,provenance='supplemental discriminator; no upstream assertion credit',**kw))
order=' ORDER BY c.rowid,b.rowid,a.rowid'
for j1,j2 in [('RIGHT','RIGHT'),('FULL','FULL'),('RIGHT','FULL'),('FULL','RIGHT')]:
 add(j1.lower()+'-'+j2.lower(),'SELECT a.k,a.v,b.k,b.v,c.k,c.v FROM a '+j1+' JOIN b ON a.k=b.k '+j2+' JOIN c ON b.k=c.k'+order,['typed','duplicates','unmatched'])
add('downstream-inner','SELECT a.k,b.k,c.k,z.k FROM a FULL JOIN b ON a.k=b.k RIGHT JOIN c ON b.k=c.k JOIN c z INDEXED BY c_k ON z.k=c.k ORDER BY c.rowid,b.rowid,a.rowid,z.rowid',['downstream-inner','index'])
add('downstream-left','SELECT a.k,b.k,c.k,z.k FROM a RIGHT JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k LEFT JOIN e z ON z.k=c.k'+order,['downstream-left','empty'])
add('mixed-left','SELECT a.k,b.k,c.k,z.k FROM a LEFT JOIN e z ON a.k=z.k RIGHT JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k'+order,['mixed-left-right-full'])
add('empty-first','SELECT e.k,b.k,c.k FROM e FULL JOIN b ON e.k=b.k FULL JOIN c ON b.k=c.k ORDER BY c.rowid,b.rowid',['empty'])
add('empty-middle','SELECT a.k,e.k,c.k FROM a RIGHT JOIN e ON a.k=e.k FULL JOIN c ON e.k=c.k ORDER BY c.rowid,a.rowid',['empty'])
add('empty-last','SELECT a.k,b.k,e.k FROM a FULL JOIN b ON a.k=b.k RIGHT JOIN e ON b.k=e.k ORDER BY b.rowid,a.rowid',['empty'])
add('on-filter','SELECT a.k,b.k,c.k FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k AND c.k=1'+order,['on-vs-where'])
add('where-filter','SELECT a.k,b.k,c.k FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k WHERE c.k=1'+order,['on-vs-where'])
add('using','SELECT k,a.v,b.v,c.v FROM a FULL JOIN b USING(k) FULL JOIN c USING(k)'+order,['using','metadata'])
add('natural','SELECT * FROM a NATURAL FULL JOIN b NATURAL FULL JOIN c'+order,['natural','metadata'])
add('alias-on','SELECT c.k AS ck,a.k,b.k FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON ck=b.k'+order,['on-alias','readiness'])
add('aggregate','SELECT c.k,count(*),sum(a.k) FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k GROUP BY c.k ORDER BY c.k',['aggregate'])
add('window','SELECT a.k,b.k,c.k,row_number() OVER(ORDER BY c.rowid,b.rowid,a.rowid) FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k'+order,['window'])
add('correlated','SELECT a.k,b.k,c.k,(SELECT z.v FROM c z WHERE z.k=c.k ORDER BY z.rowid LIMIT 1) FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k'+order,['correlated'])
add('rebind','SELECT a.k,b.k,c.k FROM a FULL JOIN b ON a.k=b.k AND b.k>?1 FULL JOIN c ON b.k=c.k'+order,['reset','rebind'],bindings=[{'type':'integer','value':'0'}],rebind=[{'type':'integer','value':'2'}])
add('resolution-error','SELECT no_such_column FROM a RIGHT JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k',['error'])
# Neighbouring boundary: native succeeds, TS must remain unsupported; not tranche admission.
add('wr-boundary','SELECT a.k,wr.k,c.k FROM a RIGHT JOIN wr ON a.k=wr.k FULL JOIN c ON wr.k=c.k ORDER BY c.rowid,a.rowid',['wr-boundary'])
out={'schema':'jsqlite-repeated-right-full/1','source':{'sourceId':d.sqlite3_sourceid().decode(),'version':d.sqlite3_libversion().decode()},'setup':setup,'cases':[],'fixtures':{}}
for enc,pragma in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 sqls=["PRAGMA encoding='"+pragma+"';"]+setup
 path=root/f'test/conformance/fixtures/repeated-right-full-{enc}.db'
 assert not path.exists(),f'refuse overwrite frozen fixture {path}'
 db=h.P();assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 try:
  for sql in sqls:assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0,sql
 finally:assert d.sqlite3_close(db)==0
 out['fixtures'][enc]={'path':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 for case in cases:
  out['cases'].append(dict(case,encoding=enc,native=h.capture(d,{'setups':{enc:sqls}},dict(case,setup=enc))))
# Persist exact source identity and source hashes; fixture bytes and expectations frozen together.
out['sourceHashes']={p:hashlib.sha256((root/'reference/sqlite/sqlite-src-3530400'/p).read_bytes()).hexdigest() for p in ['src/whereInt.h','src/where.c','src/wherecode.c','src/select.c','src/resolve.c','src/vdbe.c','src/vdbeaux.c','test/join8.test']}
(root/'test/conformance/cases/repeated-right-full.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('native source-ID checked; frozen',len(out['cases']),'cases; 3 encodings')
