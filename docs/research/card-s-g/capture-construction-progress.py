import ctypes as C,importlib.util,pathlib,json,sys
sys.dont_write_bytecode=True
r=pathlib.Path(__file__).resolve().parents[3];s=importlib.util.spec_from_file_location('n',r/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n);d=n.load(sys.argv[1]);pin=json.loads((r/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId'];db=C.c_void_p();assert d.sqlite3_open(b':memory:',C.byref(db))==0
n.execsql(d,db,'CREATE TABLE t(a,b,c,d,e,f); CREATE INDEX ix ON t(a,b,c,d,e,f);')
CB=C.CFUNCTYPE(C.c_int);d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,CB,C.c_void_p];hits=[];cb=CB(lambda:(hits.append(1) or 1));d.sqlite3_progress_handler(db,1,cb,None)
q='SELECT f FROM t INDEXED BY ix WHERE a=1 AND b=2 AND c=3 AND d=4 AND e=5 AND f=6';st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,q.encode(),-1,C.byref(st),None);d.sqlite3_finalize(st);assert rc==9,(rc,len(hits));d.sqlite3_progress_handler(db,0,cb,None)
rows,_=n.query(d,db,q);assert rows==[];assert d.sqlite3_close(db)==0
(r/'docs/research/card-s-g/construction-progress-native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'sql':q,'prepareRc':rc,'callbackCount':len(hits),'recoveryRows':rows,'chronology':'before planner progress repair; in-memory development oracle, no fixture mutation'},indent=2)+'\n');print('PASS native prepare interrupt9 and same-connection recovery')
