import json,subprocess,sys
cli,out=sys.argv[1:]
identity=subprocess.check_output([cli,':memory:','select sqlite_version(),sqlite_source_id()'],text=True).strip()
assert identity=='3.53.4|2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
texts=['Inf','inf','infinity','QNaN','SNaN','nan','NaN','Infinity','[Inf]']
for name in ['inf','infinity','NaN','QNaN','SNaN','true','false','null']:
 variants=list(dict.fromkeys([name,name.lower(),name.upper(),''.join(c.upper() if i%2 else c.lower() for i,c in enumerate(name))]))
 for variant in variants:
  for sign in ['', '+','-']:
   t=sign+variant
   for suffix in ['', 'x','0','_','é','\0','/*x*/','//x\n',',',']','}', 'ity']:
    x=t+suffix;texts.extend([x,'['+x+']','{"é":'+x+'}'])
   texts.extend(['{'+t+':0}','{"'+t+'":0}'])
 for i in range(1,len(name)):texts.extend([name[:i],'['+name[:i]+']'])
rows=[]
for t in dict.fromkeys(texts):
 h=t.encode().hex();x=f"cast(x'{h}' as text)"
 expected=subprocess.check_output([cli,':memory:','select '+','.join(f'json_valid({x},{f})' for f in [1,2,15])+f',json_error_position({x})'],text=True).strip().split('|')
 render=None;composition=None
 if expected[1]=='1':
  render=subprocess.check_output([cli,':memory:',f'select hex(json({x})),hex(jsonb({x}))'],text=True).strip().split('|')
  composition=subprocess.check_output([cli,':memory:',f"select json_type({x}),typeof(json_extract({x},'$')),hex(json(jsonb({x})))"],text=True).strip().split('|')
 rows.append(dict(hex=h,storage='text',expected=expected,render=render,composition=composition))
json.dump(rows,open(out,'w'),indent=2);print(identity,len(rows),'native token cases')
