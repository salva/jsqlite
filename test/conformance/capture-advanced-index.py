#!/usr/bin/env python3
"""Pinned native producer for the advanced-index contract; development-only writes."""
import argparse,ctypes as C,hashlib,importlib.util,json,pathlib,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE=ROOT/'test/conformance/capture-index-planner.py'
m=importlib.util.spec_from_file_location('ordinary_capture',BASE); mod=importlib.util.module_from_spec(m);m.loader.exec_module(mod)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--library',required=True);ap.add_argument('--spec',default=str(ROOT/'test/conformance/cases/stage3-advanced-index.spec.json'));ap.add_argument('--fixture-root',default=str(ROOT/'test/conformance/fixtures'));ap.add_argument('--output',default=str(ROOT/'test/conformance/cases/stage3-advanced-index.json'));a=ap.parse_args()
 spec=json.loads(pathlib.Path(a.spec).read_text());d=mod.load(a.library)
 d.sqlite3_errmsg.restype=C.c_char_p;d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errcode.argtypes=[C.c_void_p];d.sqlite3_limit.argtypes=[C.c_void_p,C.c_int,C.c_int];d.sqlite3_limit.restype=C.c_int
 if d.sqlite3_libversion().decode()!=spec['source']['version'] or d.sqlite3_sourceid().decode()!=spec['source']['sourceId']:raise SystemExit('pinned SQLite identity mismatch')
 variants=[]
 for variant in spec['encodingVariants']:
  f=pathlib.Path(a.fixture_root)/f"advanced-index-{variant['id']}.db";f.unlink(missing_ok=True);db=mod.C.c_void_p()
  if d.sqlite3_open(str(f).encode(),mod.C.byref(db))!=mod.OK:raise RuntimeError('open setup')
  try:
   mod.execsql(d,db,f"PRAGMA encoding='{variant['pragma']}'")
   for sql in spec['setup']:mod.execsql(d,db,sql)
  finally:d.sqlite3_close(db)
  raw=f.read_bytes();db=mod.C.c_void_p()
  if d.sqlite3_open_v2(str(f).encode(),mod.C.byref(db),mod.SQLITE_OPEN_READONLY,None)!=mod.OK:raise RuntimeError('readonly reopen')
  try:
   schema=mod.query(d,db,"SELECT type,name,tbl_name,rootpage,sql FROM sqlite_schema WHERE rootpage>0 ORDER BY name")[0]
   xinfo={name:mod.query(d,db,f"PRAGMA index_xinfo('{name}')")[0] for name in ('sqlite_autoindex_wr_1','wr_c','p_live','e_expr','m_abc')}
   cases=[]
   for c in spec['cases']:
    rows=mod.query(d,db,c['sql'],c['bindings'])[0];eqp=mod.explain(d,db,'EXPLAIN QUERY PLAN ',c['sql'],c['bindings'])
    caseRows,counters=mod.query(d,db,c['sql'],c['bindings']);assert caseRows==rows
    cases.append({'id':c['id'],'sql':c['sql'],'bindings':c['bindings'],'rows':rows,'eqp':eqp,'work':counters})
   # Exercise one prepared statement through step/DONE, reset, clear/rebind,
   # a second execution, and finalize on the same read-only connection.
   lc=spec['lifecycle'];st=C.c_void_p();rc=d.sqlite3_prepare_v2(db,next(c['sql'] for c in spec['cases'] if c['id']==lc['case']).encode(),-1,C.byref(st),None);assert rc==mod.OK
   def run_prepared(values):
    mod.bind(d,st,values);out=[]
    while True:
     code=d.sqlite3_step(st)
     if code==mod.ROW:out.append([mod.cell(d,st,i) for i in range(d.sqlite3_column_count(st))]);continue
     assert code==mod.DONE;return out
   first=run_prepared(lc['firstBindings']);resetRc=d.sqlite3_reset(st);clearRc=d.sqlite3_clear_bindings(st);second=run_prepared(lc['secondBindings']);finalizeRc=d.sqlite3_finalize(st)
   lifecycle={'firstRows':first,'resetCode':resetRc,'clearBindingsCode':clearRc,'secondRows':second,'finalizeCode':finalizeRc}
   errors=[]
   for ec in spec['errorCases']:
    prior=None
    if 'limit' in ec: prior=d.sqlite3_limit(db,ec['limit']['id'],ec['limit']['value'])
    est=C.c_void_p();prepare=d.sqlite3_prepare_v2(db,ec['sql'].encode(),-1,C.byref(est),None);step=None
    if prepare==mod.OK:
     bindRaw=ec['binding'].encode();bindCode=d.sqlite3_bind_text(est,1,bindRaw,len(bindRaw),mod.TRANSIENT)
     if bindCode==mod.OK:step=d.sqlite3_step(est);code=step
     else:step=None;code=bindCode
     d.sqlite3_finalize(est)
    else:code=prepare
    message=d.sqlite3_errmsg(db).decode()
    if prior is not None:d.sqlite3_limit(db,ec['limit']['id'],prior)
    reuse=mod.query(d,db,'SELECT count(*) FROM wr')[0]
    errors.append({'id':ec['id'],'prepareCode':prepare,'stepCode':step,'errorCode':code,'message':message,'reuseRows':reuse})
   variants.append({'id':variant['id'],'encoding':variant['pragma'],'fixture':{'path':str(f.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'headerPageSize':int.from_bytes(raw[16:18],'big'),'schema':schema,'indexXinfo':xinfo},'cases':cases,'lifecycle':lifecycle,'errors':errors})
  finally:d.sqlite3_close(db)
  # Corrupt only the selected secondary-index root page. The primary-key query
  # must remain isolated; forcing the damaged index must report SQLITE_CORRUPT.
  roots={mod.text(r[1]):int(r[3]['value']) for r in schema};cf=pathlib.Path(a.fixture_root)/f"advanced-index-{variant['id']}-corrupt-wr-c.db";shutil.copyfile(f,cf);damaged=bytearray(cf.read_bytes());off=(roots[spec['corruptionCases']['index']]-1)*512;damaged[off]=0;cf.write_bytes(damaged)
  cdb=C.c_void_p();assert d.sqlite3_open_v2(str(cf).encode(),C.byref(cdb),mod.SQLITE_OPEN_READONLY,None)==mod.OK
  try:
   offRows=mod.query(d,cdb,spec['corruptionCases']['offPathSql'])[0];selectedCode=mod.OK;selectedMessage=''
   try:mod.query(d,cdb,spec['corruptionCases']['selectedSql'])
   except RuntimeError:
    selectedCode=d.sqlite3_errcode(cdb);selectedMessage=d.sqlite3_errmsg(cdb).decode()
   variants[-1]['corruption']={'fixture':{'path':str(cf.relative_to(ROOT)),'bytes':len(damaged),'sha256':hashlib.sha256(damaged).hexdigest(),'damagedRootPage':roots[spec['corruptionCases']['index']]},'offPathRows':offRows,'selectedErrorCode':selectedCode,'selectedMessage':selectedMessage}
  finally:d.sqlite3_close(cdb)
 out={'schema':'jsqlite-advanced-index-capture/1','source':spec['source'],'producer':{'script':'test/conformance/capture-advanced-index.py','identityCheckedBeforeSetup':True,'reopenedReadOnly':True},'accounting':{'encodingVariants':3,'nativeCasesPerEncoding':len(spec['cases']),'pinnedNativeCaptures':3*len(spec['cases']),'attemptedPublicTsAssertions':0,'tsCreditedCases':0},'variants':variants}
 pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__':main()
