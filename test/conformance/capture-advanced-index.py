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
   xinfo={name:mod.query(d,db,f"PRAGMA index_xinfo('{name}')")[0] for name in ('sqlite_autoindex_wr_1','wr_c','p_live','e_expr','m_abc','ov_k_payload')}
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
    est=C.c_void_p();prepare=d.sqlite3_prepare_v2(db,ec['sql'].encode(),-1,C.byref(est),None);bindCode=None;step=None
    if prepare==mod.OK:
     bindCode=mod.OK
     if 'binding' in ec:
      bindRaw=ec['binding'].encode();bindCode=d.sqlite3_bind_text(est,1,bindRaw,len(bindRaw),mod.TRANSIENT)
     if bindCode==mod.OK:step=d.sqlite3_step(est);code=step
     else:step=None;code=bindCode
     d.sqlite3_finalize(est)
    else:code=prepare
    message=d.sqlite3_errmsg(db).decode()
    if prior is not None:d.sqlite3_limit(db,ec['limit']['id'],prior)
    reuse=mod.query(d,db,'SELECT count(*) FROM wr')[0]
    phase='prepare' if prepare!=mod.OK else ('bind' if bindCode!=mod.OK else 'step')
    errors.append({'id':ec['id'],'phase':phase,'prepareCode':prepare,'bindCode':bindCode,'stepCode':step,'errorCode':code,'message':message,'reuseRows':reuse})
   variants.append({'id':variant['id'],'encoding':variant['pragma'],'fixture':{'path':str(f.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'headerPageSize':int.from_bytes(raw[16:18],'big'),'schema':schema,'indexXinfo':xinfo},'cases':cases,'lifecycle':lifecycle,'errors':errors})
  finally:d.sqlite3_close(db)
  # Produce two distinct malformed selected-page companions: a secondary
  # b-tree root and an overflow page reached while reading an indexed payload.
  roots={mod.text(r[1]):int(r[3]['value']) for r in schema};corruptions=[]
  def varint(buf,pos):
   value=0
   for n in range(9):
    b=buf[pos+n]
    if n==8:return (value<<8)|b,9
    value=(value<<7)|(b&127)
    if b<128:return value,n+1
  for cc in spec['corruptionCases']:
   cf=pathlib.Path(a.fixture_root)/f"advanced-index-{variant['id']}-corrupt-{cc['id']}.db";shutil.copyfile(f,cf);damaged=bytearray(cf.read_bytes());root=roots[cc['index']];damagedPage=root
   if cc['pageKind']=='btree-root':damaged[(root-1)*512]=0
   else:
    page=(root-1)*512;hdr=0 if root!=1 else 100;cellptr=int.from_bytes(damaged[page+hdr+8:page+hdr+10],'big');cell=page+cellptr;payload,nvar=varint(damaged,cell);usable=512;maxLocal=((usable-12)*64)//255-23;minLocal=((usable-12)*32)//255-23;local=minLocal+(payload-minLocal)%(usable-4)
    if local>maxLocal:local=minLocal
    overflow=int.from_bytes(damaged[cell+nvar+local:cell+nvar+local+4],'big');assert overflow>0;damagedPage=overflow;damaged[(overflow-1)*512:(overflow-1)*512+4]=(0).to_bytes(4,'big')
   cf.write_bytes(damaged);cdb=C.c_void_p();assert d.sqlite3_open_v2(str(cf).encode(),C.byref(cdb),mod.SQLITE_OPEN_READONLY,None)==mod.OK
   try:
    offRows=mod.query(d,cdb,cc['offPathSql'])[0];selectedCode=mod.OK;selectedMessage=''
    try:mod.query(d,cdb,cc['selectedSql'])
    except RuntimeError:
     selectedCode=d.sqlite3_errcode(cdb);selectedMessage=d.sqlite3_errmsg(cdb).decode()
    reuse=mod.query(d,cdb,cc['offPathSql'])[0]
    corruptions.append({'id':cc['id'],'pageKind':cc['pageKind'],'fixture':{'path':str(cf.relative_to(ROOT)),'bytes':len(damaged),'sha256':hashlib.sha256(damaged).hexdigest(),'selectedRootPage':root,'damagedPage':damagedPage},'offPathRows':offRows,'selectedErrorCode':selectedCode,'selectedMessage':selectedMessage,'reuseRows':reuse})
   finally:d.sqlite3_close(cdb)
  variants[-1]['corruptions']=corruptions
 out={'schema':'jsqlite-advanced-index-capture/1','source':spec['source'],'producer':{'script':'test/conformance/capture-advanced-index.py','identityCheckedBeforeSetup':True,'reopenedReadOnly':True},'accounting':{'encodingVariants':3,'nativeCasesPerEncoding':len(spec['cases']),'pinnedNativeCaptures':3*len(spec['cases']),'attemptedPublicTsAssertions':0,'tsCreditedCases':0},'variants':variants}
 pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__':main()
