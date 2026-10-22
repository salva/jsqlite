#!/usr/bin/env python3
"""Pinned scalar LOOP persistent-RHS oracle; generated files are disposable."""
import argparse, ctypes as C, hashlib, json, pathlib, sys
sys.dont_write_bytecode=True
from importlib.util import spec_from_file_location, module_from_spec
p=pathlib.Path(__file__).with_name('capture-index-planner.py')
s=spec_from_file_location('oracle',p); o=module_from_spec(s); s.loader.exec_module(o)
a=argparse.ArgumentParser(); a.add_argument('--library',required=True); a.add_argument('--output',required=True); args=a.parse_args()
d=o.load(args.library)
assert 'bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc' in d.sqlite3_sourceid().decode()
out=pathlib.Path(args.output); out.mkdir(parents=True,exist_ok=True)
variants=[]
for enc in ['UTF-8','UTF-16le','UTF-16be']:
 file=enc+'.db'; path=out/file
 if path.exists(): path.unlink()
 db=C.c_void_p(); assert d.sqlite3_open(str(path).encode(),C.byref(db))==0
 o.execsql(d,db,f'''PRAGMA encoding='{enc}';CREATE TABLE t(id INTEGER PRIMARY KEY,a INTEGER);CREATE INDEX t_a ON t(a);
 CREATE TABLE rhs(v INTEGER UNIQUE);CREATE TABLE rd(v INTEGER);CREATE UNIQUE INDEX rd_v ON rd(v DESC);
 CREATE TABLE ri(v INTEGER PRIMARY KEY);CREATE TABLE rn(v INTEGER);CREATE INDEX rn_v ON rn(v);
 INSERT INTO t VALUES(1,1),(2,2),(3,3);INSERT INTO rhs VALUES(1),(3),(NULL);INSERT INTO rd SELECT v FROM rhs;
 INSERT INTO ri VALUES(1),(3);INSERT INTO rn VALUES(1),(1),(3),(NULL);''')
 d.sqlite3_close(db); assert d.sqlite3_open_v2(str(path).encode(),C.byref(db),1,None)==0
 cases=[]
 for name,rhs,reuse in [('asc','SELECT v FROM rhs',True),('desc','SELECT v FROM rd',True),('rowid','SELECT v FROM ri',True),('duplicates','SELECT v FROM rn',False),('where','SELECT v FROM rhs WHERE v>0',False),('distinct','SELECT DISTINCT v FROM rhs',False),('limit','SELECT v FROM rhs LIMIT 2',False),('aggregate','SELECT max(v) FROM rhs',False)]:
  sql=f'SELECT id FROM t INDEXED BY t_a WHERE a IN({rhs})'
  rows,work=o.query(d,db,sql); program,_=o.query(d,db,'EXPLAIN '+sql); ops=[dict(opcode=o.text(r[1]),p1=int(r[2]['value']),p2=int(r[3]['value']),p3=int(r[4]['value'])) for r in program]
  assert ('OpenEphemeral' not in [op['opcode'] for op in ops])==reuse,(name,ops)
  cases.append(dict(name=name,sql=sql,rows=rows,work=work,ops=ops,reuse=reuse))
 # A selected IN admission never licenses omitting a different conjunct.
 sql='SELECT id FROM t INDEXED BY t_a WHERE a IN(SELECT v FROM rhs) AND id=3'
 rows,work=o.query(d,db,sql); program,_=o.query(d,db,'EXPLAIN '+sql)
 ops=[dict(opcode=o.text(r[1]),p1=int(r[2]['value']),p2=int(r[3]['value']),p3=int(r[4]['value'])) for r in program]
 cases.append(dict(name='residual',sql=sql,rows=rows,work=work,ops=ops,reuse=True,residual=True))
 d.sqlite3_close(db)
 variants.append(dict(encoding=enc,fixture=file,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),cases=cases))
(out/'native.json').write_text(json.dumps(dict(sourceid=d.sqlite3_sourceid().decode(),variants=variants),indent=2)+'\n')
