import json,subprocess,sys
cli,out=sys.argv[1:]
identity=subprocess.check_output([cli,':memory:','select sqlite_version(),sqlite_source_id();'],text=True).strip();assert '3.53.4|2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'==identity
spaces=[9,10,11,12,13,32,0xa0,0x1680,*range(0x2000,0x200b),0x2028,0x2029,0x202f,0x205f,0x3000,0xfeff]
near=[0x85,0x167f,0x1681,0x1fff,0x200b,0x2027,0x202a,0x202e,0x2030,0x205e,0x2060,0x2fff,0x3001,0xfefe,0xff00]
texts=['[\v0]','[\xa00]','[\u20280]','//x\u20280','[ 0]']
for cp in spaces+near:
 w=chr(cp)
 texts += [w+'[0]', '['+w+'0]', '{"é":'+w+'[0]}', '[0]'+w, '{i'+w+':0}']
for end in ['\r','\n','\r\n','\u2028','\u2029','\x85','\u200b','']:
 texts += ['//x'+end+'0','[//é😀'+end+'0]','[0//x'+end+']']
for comment in ['/**/','/*x*/','/*/','/*','/','//','/*x','/*x*','/*\u2028*/','/*é😀*/','/*a/*b*/','//x\n','//x\u2029']:
 texts += [comment+'[0]','[0,'+comment+'1]','[0]'+comment,'["é","😀",'+comment+'"\\uZZZZ"]']
texts += ['', ' ', '\v', '//x', '/*x*/', ' \v//x', '[0,/*x*/', '[0,\v', '/*'+'x'*600+'*/[0]', '//'+('é😀'*180)+'\u20280', ('\u2000'*600)+'[0]', '[0]/*'+'x'*600, '[0, /*x','[0, //x','/*x*/ /*y','[true/*x*/]','[null//x\u2028]']
rows=[]
for text in dict.fromkeys(texts):
 h=text.encode().hex()
 for storage in ['text','blob']:
  x=f"cast(x'{h}' as text)" if storage=='text' else f"x'{h}'"
  q='select '+','.join(f'json_valid({x},{f})' for f in [1,2,15])+f',json_error_position({x});'
  expected=subprocess.check_output([cli,':memory:',q],text=True).strip().split('|')
  render=None
  if expected[1]=='1':
   render=subprocess.check_output([cli,':memory:',f'select hex(json({x})),hex(jsonb({x}));'],text=True).strip().split('|')
  rows.append(dict(hex=h,storage=storage,expected=expected,render=render))
json.dump(rows,open(out,'w'),indent=2);print(identity,len(rows),'native cases')
