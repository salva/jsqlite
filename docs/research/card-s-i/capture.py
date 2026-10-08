"""Dev-only pinned SQLite capture; no runtime native dependency."""
import ctypes as C, hashlib, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[3]
out=pathlib.Path(__file__).resolve().parent
lib=C.CDLL(sys.argv[1])
def fn(name,args,result=C.c_int):
 f=getattr(lib,name); f.argtypes=args; f.restype=result; return f
ptr=C.c_void_p
op=fn('sqlite3_open',[C.c_char_p,C.POINTER(ptr)])
prep=fn('sqlite3_prepare_v2',[ptr,C.c_char_p,C.c_int,C.POINTER(ptr),ptr])
step=fn('sqlite3_step',[ptr]); finalize=fn('sqlite3_finalize',[ptr]); close=fn('sqlite3_close',[ptr])
errmsg=fn('sqlite3_errmsg',[ptr],C.c_char_p)
count=fn('sqlite3_column_count',[ptr]); typ=fn('sqlite3_column_type',[ptr,C.c_int])
text=fn('sqlite3_column_text',[ptr,C.c_int],C.c_char_p)
integer=fn('sqlite3_column_int64',[ptr,C.c_int],C.c_longlong)
real=fn('sqlite3_column_double',[ptr,C.c_int],C.c_double)
name=fn('sqlite3_column_name',[ptr,C.c_int],C.c_char_p)
source=fn('sqlite3_sourceid',[],C.c_char_p)
manifest=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert source().decode()==manifest['sqliteSourceId']
def query(db,sql):
 s=ptr(); rc=prep(db,sql.encode(),-1,C.byref(s),None)
 if rc: return {'error':{'code':rc,'message':errmsg(db).decode()}}
 names=[name(s,i).decode() for i in range(count(s))]; rows=[]
 while True:
  rc=step(s)
  if rc==101: break
  assert rc==100,(rc,errmsg(db))
  row=[]
  for i in range(count(s)):
   t=typ(s,i)
   row.append({'type':{1:'integer',2:'real',3:'text',5:'null'}[t], 'value':str(integer(s,i)) if t==1 else real(s,i) if t==2 else text(s,i).decode() if t==3 else None})
  rows.append(row)
 finalize(s)
 return {'names':names,'rows':rows}
cases=[
 ('overlap',"SELECT k,n,v FROM w WHERE a=1 OR b=2 ORDER BY k,n"),
 ('middle',"SELECT k,n,v FROM w WHERE a=1 OR b=2 OR a=3 ORDER BY k,n"),
 ('nested',"SELECT k,n,v FROM w WHERE (a=1 OR b=2) OR (a=3 AND b=4) ORDER BY k,n"),
 ('same-arm',"SELECT k,n,v FROM w WHERE a=1 OR a=3 ORDER BY k,n"),
 ('null',"SELECT k,n,v FROM w WHERE a IS NULL OR b=2 ORDER BY k,n"),
 ('inner',"SELECT w.k,w.n,w.v FROM w JOIN u ON u.x=w.n WHERE w.a=1 OR w.b=2 ORDER BY w.k,w.n"),
 ('scalar',"SELECT (SELECT v FROM w WHERE a=1 OR b=2 ORDER BY k,n LIMIT 1) AS v"),
 ('forced',"SELECT k,n,v FROM w INDEXED BY wa WHERE a=1 OR b=2 ORDER BY k,n"),
 ('not-indexed',"SELECT k,n,v FROM w NOT INDEXED WHERE a=1 OR b=2 ORDER BY k,n"),
 ('no-rowid',"SELECT rowid FROM w WHERE a=1 OR b=2")]
variants=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 path=out/(encoding+'.db'); path.unlink(missing_ok=True); db=ptr(); assert op(str(path).encode(),C.byref(db))==0
 for sql in [f"PRAGMA encoding='{encoding}'",'CREATE TABLE w(n INTEGER,k TEXT COLLATE NOCASE,v REAL,a INTEGER,b INTEGER,PRIMARY KEY(k DESC,n)) WITHOUT ROWID','CREATE INDEX wa ON w(a,k)','CREATE INDEX wb ON w(b)','CREATE TABLE u(x INTEGER PRIMARY KEY)']:
  assert 'error' not in query(db,sql)
 for i in range(1,401):
  k=['Alpha','beta','Éclair','zeta'][i%4]+str(i//4)
  a='NULL' if i==7 else str(i%19); b=str(i%23)
  assert 'error' not in query(db,f"INSERT INTO w VALUES({i},'{k}',{i}.0,{a},{b})")
  assert 'error' not in query(db,f'INSERT INTO u VALUES({i})')
 captured=[]
 for id,sql in cases:
  data=query(db,sql)
  captured.append({'id':id,'sql':sql,'classification':'supplemental','sourceBranch':'wherecode.c Case5 WR' if id in ['overlap','middle','nested','inner','scalar'] else 'boundary companion',**data,'eqp':query(db,'EXPLAIN QUERY PLAN '+sql),'explain':query(db,'EXPLAIN '+sql)})
 for sql in ['CREATE TABLE t3(a,b,c,d,PRIMARY KEY(c,b)) WITHOUT ROWID',"INSERT INTO t3 VALUES('f',1,1,'o'),('o',2,1,'t'),('t',1,2,'t'),('t',2,2,'f')",'CREATE INDEX t3i1 ON t3(d)','CREATE INDEX t3i2 ON t3(a)']:
  assert 'error' not in query(db,sql)
 exactSql="SELECT c||'.'||b FROM t3 WHERE a='t' OR d='t'"
 exact=query(db,exactSql)
 assert [r[0]['value'] for r in exact['rows']]==['2.1','2.2','1.2']
 captured.append({'id':'whereI-3.0','sql':exactSql,'classification':'exact SQL/schema/data from pinned test/whereI.test 3.0',**exact,'eqp':query(db,'EXPLAIN QUERY PLAN '+exactSql),'explain':query(db,'EXPLAIN '+exactSql)})
 close(db)
 variants.append({'encoding':encoding,'fixture':{'path':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'cases':captured})
(out/'native.json').write_text(json.dumps({'sourceId':source().decode(),'librarySha256':hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest(),'classification':'One exact SQL/schema/data case (`whereI-3.0`); remaining cases are supplemental authored probes, not upstream test transcriptions','variants':variants},indent=2)+'\n')
