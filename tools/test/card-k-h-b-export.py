#!/usr/bin/env python3
"""Reproducible committed base + attributed workspace dependency overlay.
No staging or peer ownership transfer. Output must be disposable card work path.
"""
import argparse,hashlib,json,pathlib,subprocess,tarfile,io,shutil
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--inventory',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[2];out=pathlib.Path(a.output);out.mkdir(parents=True,exist_ok=True)
head,tree=subprocess.check_output(['git','rev-parse','HEAD','HEAD^{tree}'],cwd=root,text=True).split()
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',head],cwd=root))) as t:t.extractall(out,filter='data')
# Full production/conformance trees deliberately include inherited dependencies;
# overlay attribution is evidence reuse, not claiming authorship of peer work.
paths=[]
for directory in ['src','test/conformance']:
 paths.extend(p for p in (root/directory).rglob('*') if p.is_file() and "__pycache__" not in p.parts)
# rowset.test.mjs compiles the pinned C implementation; retain that source as
# an inventoried test dependency, not as native production runtime machinery.
paths.extend(root/p for p in ['package.json','package-lock.json','tsconfig.json','reference/sqlite/manifest.json','reference/sqlite/sqlite-src-3530400/src/rowset.c'])
rows=[]
for source in sorted(paths):
 rel=source.relative_to(root).as_posix();target=out/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
 try:base=subprocess.check_output(['git','show',head+':'+rel],cwd=root,stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:base=None
 raw=source.read_bytes();rows.append({'path':rel,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'input':'commit' if base==raw else 'explicit dependency overlay (inherited or own; no authorship transfer)'})
d={'commit':head,'tree':tree,'overlayPolicy':'Full production and conformance dependency trees; inherited bitwise/index/native-first inputs reused without peer authorship transfer. Other committed files from git archive.','files':rows,'prerequisites':{'node':{'version':subprocess.check_output(['node','--version'],text=True).strip(),'sha256':hashlib.sha256(pathlib.Path(shutil.which('node')).read_bytes()).hexdigest()},'typescript':[{'path':p.relative_to(root).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((root/'node_modules/typescript').rglob('*')) if p.is_file()],'nativeIdentity':json.loads((root/'reference/sqlite/manifest.json').read_text())},'indexDiffSha256':hashlib.sha256(subprocess.check_output(['git','diff','--cached','--binary'],cwd=root)).hexdigest()}
pathlib.Path(a.inventory).write_text(json.dumps(d,indent=2)+'\n');print('export',head,tree,'dependency files',len(rows))
