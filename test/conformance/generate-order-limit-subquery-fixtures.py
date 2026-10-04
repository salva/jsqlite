import ctypes as C,importlib.util,json,pathlib,os
sp=importlib.util.spec_from_file_location('m','test/conformance/capture-subquery-view.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);d=m.load(os.environ['SAIVAGE_CARD_WORK_ROOT']+'/oracle-build/build/libsqlite3-oracle.so');assert d.sqlite3_sourceid().decode()==json.load(open('reference/sqlite/manifest.json'))['sqliteSourceId']
d.sqlite3_exec.argtypes=[m.P,C.c_char_p,m.P,m.P,m.P]
g=json.load(open('test/fixtures/CURRENT.json'))['generationId'];src=pathlib.Path(f'test/fixtures/generations/{g}/generated/expr-relational.db');db=m.P();assert d.sqlite3_open_v2(str(src).encode(),C.byref(db),1,None)==0
s=m.P();d.sqlite3_prepare_v2(db,b'SELECT x,y FROM t1',-1,C.byref(s),None);rs=m.run(d,db,s,2)['rows'];d.sqlite3_finalize(s);d.sqlite3_close(db)
for enc in ('UTF-16le','UTF-16be'):
 p=pathlib.Path('test/conformance/fixtures')/('order-limit-relational-'+enc.lower().replace('-','')+'.db');p.unlink(missing_ok=True);db=m.P();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),6,None)==0
 sql=f"PRAGMA encoding='{enc}';CREATE TABLE t1(x INT,y INT);"+''.join(f"INSERT INTO t1 VALUES({r[0]['value']},{r[1]['value']});" for r in rs)
 assert d.sqlite3_exec(db,sql.encode(),None,None,None)==0;d.sqlite3_close(db)
 print(p)
