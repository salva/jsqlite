#!/usr/bin/env python3
"""Independent pinned parameter binding oracle; no parameter plan parity claim."""
import argparse,ctypes as C,hashlib,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[4]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);a=p.parse_args();d=n.load(a.library)
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
base=ROOT/'docs/research/card-s-h';original=json.loads((base/'caller-native.json').read_text());variants=[]
values=[0,0.0,'0','0.0',' 0 ',{'type':'blob','hex':'30'},None,99,'99']
for v in original['variants']:
 f=base/v['fixture'];assert hashlib.sha256(f.read_bytes()).hexdigest()==v['sha256'];db=C.c_void_p();assert d.sqlite3_open_v2(str(f).encode(),C.byref(db),1,None)==0
 cases=[]
 for value in values:
  rows,counters=n.query(d,db,'SELECT id,r,b FROM t WHERE a=?1 AND r=7.0 ORDER BY id',[value]);cases.append({'binding':value,'bindingType':'real' if isinstance(value,float) else 'integer' if isinstance(value,int) else 'other','rows':rows})
 assert d.sqlite3_close(db)==0;variants.append({'encoding':v['encoding'],'fixture':v['fixture'],'sha256':v['sha256'],'cases':cases})
pathlib.Path(a.output).write_text(json.dumps({'sourceId':manifest['sqliteSourceId'],'librarySha256':hashlib.sha256(pathlib.Path(a.library).read_bytes()).hexdigest(),'sql':'SELECT id,r,b FROM t WHERE a=?1 AND r=7.0 ORDER BY id','variants':variants},indent=2)+'\n')
