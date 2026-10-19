#!/usr/bin/env python3
"""Pinned CLI numerical-production capture; development only."""
import json,subprocess,sys
cases=['1e','[1e]','1e+','1e-',' 1e','["é",1e]','["😀",1e+]','01','-01','+01','0x','0xg','-0x','+0x','0x10','-0x10','+0x10','.e','.5','-.5','+.5','1.','1.e2','1.e','1e2e3','1e2.3','1..2','1e+2','-','+','.', '1e/*x*/','[1e+]','{"é":1e-}','["😀", 1e-]','[1,2]','1/*x*/','1x','1e2x','+Inf','-Infinity','true','tru','nulx']
def run(sql):
 p=subprocess.run([sys.argv[1],':memory:'],input='.mode json\n'+sql,text=True,capture_output=True,check=True)
 return json.loads(p.stdout)
identity=run('select sqlite_version() as version,sqlite_source_id() as source;')[0]
rows=[]
for text in cases:
 q="'"+text.replace("'","''")+"'"
 r=run(f'select json_error_position({q}) as position,json_valid({q}) as strict,json_valid({q},2) as json5;')[0]
 if r['position']==0:r.update(run(f'select json({q}) as canonical,hex(jsonb({q})) as hex;')[0])
 rows.append(dict(text=text,**r))
print(json.dumps(dict(identity=identity,cases=rows),ensure_ascii=False,indent=2))
