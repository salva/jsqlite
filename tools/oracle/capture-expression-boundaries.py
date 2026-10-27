#!/usr/bin/env python3
"""Q21 source-owned paired-suite capture; never mutates CURRENT or fixtures.
Use a fresh output directory. Generated DB bytes must equal caller-consumed DBs.
"""
import argparse,hashlib,json,pathlib,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--fixture-helper',required=True);p.add_argument('--node',required=True);p.add_argument('--output',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(a.output).resolve();out.mkdir(parents=True,exist_ok=False)
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def run(args,name):
 with (out/name).open('wb') as f:subprocess.run(args,cwd=root,stdout=f,stderr=subprocess.STDOUT,check=True,timeout=100)
 return {'argv':list(map(str,args)),'output':name,'sha256':sha(out/name),'exit':0}
g=json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId'];files={};commands=[]
for enc,native in [('utf8','UTF-8'),('utf16le','UTF-16le'),('utf16be','UTF-16be')]:
 ident='subquery-'+enc;db=out/(ident+'.db')
 commands.append(run([a.fixture_helper,ident,native,str(db)],ident+'.producer.txt'))
 consumed=root/f'test/fixtures/generations/{g}/generated/{ident}.db'
 assert sha(db)==sha(consumed),(db,consumed,'caller fixture mismatch')
 files[str(consumed.relative_to(root))]=sha(consumed)
for name in ['select-collate-scalar-width','function-descriptor-resolution','function-registration-boundaries']:
 native='test/conformance/'+name+'-native.py';public='test/conformance/'+name+'.test.mjs'
 commands.append(run([sys.executable,native,a.library],name+'.native.txt'))
 commands.append(run([a.node,'--experimental-strip-types','--test','--test-concurrency=1','--test-timeout=100000',public],name+'.public.txt'))
 for f in [native,public]:files[f]=sha(root/f)
for f in ['tools/oracle/sqlite_fixture.c','tools/oracle/build.sh','tools/oracle/generate-fixtures.py','tools/oracle/verify-source.py','reference/sqlite/manifest.json','test/fixtures/CURRENT.json',f'test/fixtures/generations/{g}/catalog.json','src/internal/functions.ts','src/internal/resolve.ts','src/internal/vdbe.ts','src/internal/json.ts','src/index.ts','tools/oracle/capture-expression-boundaries.py']:files[f]=sha(root/f)
receipt={'schema':'expression-boundary-capture/1','generation':g,'files':files,'executables':{str(pathlib.Path(f).resolve()):sha(f) for f in [a.library,a.fixture_helper,a.node]},'commands':commands,'scope':'author paired capture; no central enrollment or whole-tree authentication'}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print(out/'receipt.json')
