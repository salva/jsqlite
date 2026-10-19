import json,subprocess,sys
cli,out=sys.argv[1:]
id=subprocess.check_output([cli,':memory:','select sqlite_version(),sqlite_source_id()'],text=True).strip();assert id=='3.53.4|2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
texts=['"a\tb"','"a\nb"','"a\x01b"','"a\\tb"','"a\0b"']
for c in range(32):
 for q in ['"',"'"]:
  for body in ['a'+chr(c)+'b','a\\u%04xb'%c]:
   t=q+body+q;texts += [t,'['+t+']','{'+t+':'+t+'}']
for q in ['"',"'"]:
 for body in ['','a"b',"a'b",'a\\"b',"a\\'b",'a\\\\b','a\\/b',*['a\\'+x+'b' for x in ['b','f','n','r','t','v','0','01','09','x41','x4Z','x','u0041','uZZZZ','u123','q']],*['a\\'+x+'b' for x in ['\n','\r','\r\n','\u2028','\u2029']], 'é😀\\uZZZZ']:
  t=q+body+q;texts += [t,'['+t+']','{'+t+':0}']
 for tail in ['', 'abc','abc\\','abc\\u','abc\\x','abc\0','abc\n']:
  texts += [q+tail,'['+q+tail,'{"é":'+q+tail]
texts += ['"'+('a'*600)+'\tend"',"'"+('a'*600)+'"end' + "'"]
rows=[]
for t in dict.fromkeys(texts):
 h=t.encode().hex();x=f"cast(x'{h}' as text)"
 expected=subprocess.check_output([cli,':memory:','select '+','.join(f'json_valid({x},{f})' for f in [1,2,15])+f',json_error_position({x})'],text=True).strip().split('|')
 render=None
 if expected[1]=='1':render=subprocess.check_output([cli,':memory:',f'select hex(json({x})),hex(jsonb({x}))'],text=True).strip().split('|')
 rows.append(dict(hex=h,storage='text',expected=expected,render=render))
json.dump(rows,open(out,'w'),indent=2);print(id,len(rows),'native string cases')
