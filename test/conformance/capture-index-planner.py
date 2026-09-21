#!/usr/bin/env python3
"""Create and capture the pinned persistent-index planner fixture.

Development-only. Setup writes are performed by the manifest-pinned library; the
committed database is then reopened read-only for every assertion. Native rows,
EQP, VDBE cursor operations, and stmt-status work are evidence, not TS credit.
"""
from __future__ import annotations
import argparse, ctypes as C, hashlib, json, pathlib, struct

ROOT=pathlib.Path(__file__).resolve().parents[2]
OK,ROW,DONE=0,100,101
SQLITE_OPEN_READONLY=1
FULLSCAN_STEP,SORT,VM_STEP=1,2,4
TRANSIENT=C.c_void_p(-1)

def load(path):
 d=C.CDLL(path)
 d.sqlite3_sourceid.restype=C.c_char_p; d.sqlite3_libversion.restype=C.c_char_p
 d.sqlite3_open.argtypes=[C.c_char_p,C.POINTER(C.c_void_p)]; d.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(C.c_void_p),C.c_int,C.c_char_p]
 d.sqlite3_close.argtypes=[C.c_void_p]; d.sqlite3_exec.argtypes=[C.c_void_p,C.c_char_p,C.c_void_p,C.c_void_p,C.POINTER(C.c_char_p)]
 d.sqlite3_prepare_v2.argtypes=[C.c_void_p,C.c_char_p,C.c_int,C.POINTER(C.c_void_p),C.c_void_p]; d.sqlite3_step.argtypes=[C.c_void_p]; d.sqlite3_finalize.argtypes=[C.c_void_p]
 d.sqlite3_reset.argtypes=[C.c_void_p]; d.sqlite3_clear_bindings.argtypes=[C.c_void_p]
 d.sqlite3_bind_int64.argtypes=[C.c_void_p,C.c_int,C.c_int64]; d.sqlite3_bind_double.argtypes=[C.c_void_p,C.c_int,C.c_double]
 d.sqlite3_bind_text.argtypes=[C.c_void_p,C.c_int,C.c_char_p,C.c_int,C.c_void_p]; d.sqlite3_bind_null.argtypes=[C.c_void_p,C.c_int]
 d.sqlite3_column_count.argtypes=[C.c_void_p]; d.sqlite3_column_type.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_int64.restype=C.c_int64; d.sqlite3_column_double.restype=C.c_double
 d.sqlite3_column_text.restype=C.c_void_p; d.sqlite3_column_blob.restype=C.c_void_p
 d.sqlite3_column_int64.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_double.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_bytes.argtypes=[C.c_void_p,C.c_int]
 d.sqlite3_column_text.argtypes=[C.c_void_p,C.c_int]; d.sqlite3_column_blob.argtypes=[C.c_void_p,C.c_int]
 d.sqlite3_stmt_status.argtypes=[C.c_void_p,C.c_int,C.c_int]
 return d

def execsql(d,db,sql):
 err=C.c_char_p(); rc=d.sqlite3_exec(db,sql.encode(),None,None,C.byref(err))
 if rc!=OK: raise RuntimeError(f"{sql}: {err.value!r}")

def bind(d,st,values):
 for i,v in enumerate(values,1):
  if v is None: rc=d.sqlite3_bind_null(st,i)
  elif isinstance(v,int): rc=d.sqlite3_bind_int64(st,i,v)
  elif isinstance(v,float): rc=d.sqlite3_bind_double(st,i,v)
  else:
   raw=v.encode(); rc=d.sqlite3_bind_text(st,i,raw,len(raw),TRANSIENT)
  if rc!=OK: raise RuntimeError(f'bind {i}: {rc}')

def cell(d,st,i):
 t=d.sqlite3_column_type(st,i)
 if t==5:return {'type':'null'}
 if t==1:return {'type':'integer','value':str(d.sqlite3_column_int64(st,i))}
 if t==2:return {'type':'real','ieee754be':struct.pack('>d',d.sqlite3_column_double(st,i)).hex()}
 n=d.sqlite3_column_bytes(st,i); p=d.sqlite3_column_blob(st,i) if t==4 else d.sqlite3_column_text(st,i); raw=C.string_at(p,n) if p else b''
 return {'type':'blob','hex':raw.hex()} if t==4 else {'type':'text','utf8Hex':raw.hex()}

def query(d,db,sql,values=()):
 st=C.c_void_p(); rc=d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)
 if rc!=OK: raise RuntimeError(f'prepare {rc}: {sql}')
 bind(d,st,values); rows=[]
 while True:
  rc=d.sqlite3_step(st)
  if rc==ROW: rows.append([cell(d,st,i) for i in range(d.sqlite3_column_count(st))]); continue
  if rc!=DONE: raise RuntimeError(f'step {rc}: {sql}')
  break
 counters={'fullscanSteps':d.sqlite3_stmt_status(st,FULLSCAN_STEP,0),'sortOperations':d.sqlite3_stmt_status(st,SORT,0),'vmSteps':d.sqlite3_stmt_status(st,VM_STEP,0)}
 d.sqlite3_finalize(st); return rows,counters

def text(cell): return bytes.fromhex(cell['utf8Hex']).decode()
def explain(d,db,prefix,sql,values):
 rows,_=query(d,db,prefix+sql,values)
 if prefix.startswith('EXPLAIN QUERY'): return [text(r[3]) for r in rows]
 return [{'opcode':text(r[1]),'p1':int(r[2]['value']),'p2':int(r[3]['value']),'p3':int(r[4]['value'])} for r in rows if text(r[1]) in {'OpenRead','SeekGE','SeekGT','SeekLE','SeekLT','IdxGT','IdxGE','IdxLT','IdxLE','DeferredSeek','IdxRowid','Column','Next','Prev','Rewind','SorterOpen','Sort','SorterSort'}]

def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--library',required=True); ap.add_argument('--spec',required=True); ap.add_argument('--fixture',required=True); ap.add_argument('--output',required=True); a=ap.parse_args()
 spec=json.load(open(a.spec)); d=load(a.library); sid=d.sqlite3_sourceid().decode()
 assert sid==spec['source']['sourceId'] and d.sqlite3_libversion().decode()==spec['source']['version']
 fixture=pathlib.Path(a.fixture).resolve(); fixture.parent.mkdir(parents=True,exist_ok=True); fixture.unlink(missing_ok=True)
 db=C.c_void_p(); assert d.sqlite3_open(str(fixture).encode(),C.byref(db))==OK
 for sql in spec['setup']: execsql(d,db,sql)
 execsql(d,db,'VACUUM'); d.sqlite3_close(db)
 raw=fixture.read_bytes(); db=C.c_void_p(); assert d.sqlite3_open_v2(str(fixture).encode(),C.byref(db),SQLITE_OPEN_READONLY,None)==OK
 schema_rows,_=query(d,db,"SELECT type,name,tbl_name,rootpage,coalesce(sql,'') FROM sqlite_schema WHERE rootpage>0 ORDER BY name")
 xinfo={name:query(d,db,f"PRAGMA index_xinfo('{name}')")[0] for name in ['ix_ab_desc','ix_c','sqlite_autoindex_t_1','sqlite_autoindex_up_t1_1','sqlite_autoindex_up_t1_2','up_t1c','up_t1d']}
 cases=[]
 for case in spec['cases']:
  runs=case.get('bindingRuns',[case.get('bindings',[])])
  captures=[]
  for values in runs:
   rows,counters=query(d,db,case['sql'],values)
   captures.append({'bindings':values,'rows':rows,'eqp':explain(d,db,'EXPLAIN QUERY PLAN ',case['sql'],values),'cursorProgram':explain(d,db,'EXPLAIN ',case['sql'],values),'work':counters})
  cases.append({**case,'nativeRuns':captures,'ts':{'disposition':'attempted-zero-credit','attempted':['openFixture','prepare','stepAll'],'unattempted':['assertPrivatePlan','assertCursorWork'],'credit':False}})
 d.sqlite3_close(db)
 out={'schema':'jsqlite-index-planner-capture/1','source':spec['source'],'upstreamAnchors':spec['upstreamAnchors'],'fixture':{'path':str(fixture.relative_to(ROOT)) if fixture.is_relative_to(ROOT) else fixture.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'headerPageSize':int.from_bytes(raw[16:18],'big') or 65536,'schema':schema_rows,'indexXinfo':xinfo},'privateCounterContract':{'scope':'per execution; reset to zero before each binding run','fields':['plannerCandidates','plannerPaths','indexSeeks','indexNext','tableSeeks','tableNext','residualTests','sorterRows'],'rule':'counts are path-local events, not elapsed time; candidate/path counters are bounded by declared planner limits; cursor counters count successful movement attempts; residualTests counts executed residual predicates; sorterRows is zero only when complete ordering is proven'},'cases':cases,'atomicGates':[{**g,'ts':{'disposition':'unattempted-atomic-zero-credit','attempted':[],'unattempted':['prepare'],'credit':False}} for g in spec['atomicGates']], 'accounting':{'pinnedCaptures':len(cases),'attemptedPublicTsAssertions':len(cases),'companions':0,'atomicUnattemptedGaps':len(spec['atomicGates']),'tsCreditedCases':0}}
 pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
 print(f"captured {len(cases)} cases, {len(spec['atomicGates'])} gates, fixture {len(raw)} bytes {out['fixture']['sha256']}")
if __name__=='__main__': main()
