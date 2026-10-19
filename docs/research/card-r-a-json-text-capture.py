import json, subprocess, sys
texts=['{i\\uZZZZ','{i\\u123Z','{i\\u123','{i:0}','{i\\u0061:0}','{\\u0061:0}','{é:0}','{😀:0}']
for raw in ['\\uZZZZ','\\uZ123','\\u1Z23','\\u12Z3','\\u123Z','\\u123','\\xZ1','\\x1Z','\\x1','\\q','\\01','\\','abc']:
 for pre,post in [('{i',''),('{i',':0}'),('{"','":0}'),('["','"]'),('{i:"','"}'),('[{"i":"','"}]')]: texts.append(pre+raw+post)
for s in ['{i\\u0061:0}','{i\\uZZZZ','["é","\\uZZZZ"]','["😀","\\xZ1"]','{"i" 1}','{i 1}','{i "\\xZZ"}','{i "\\uZZZZ"}','{i\\q:0}']:texts.append(s)
rows=[]
for text in dict.fromkeys(texts):
 h=text.encode().hex()
 for storage in ['blob','text']:
  x=f"x'{h}'" if storage=='blob' else f"cast(x'{h}' as text)"
  sql='select '+','.join(f'json_valid({x},{f})' for f in [1,2,4,8,15])+f',json_error_position({x});'
  expected=subprocess.check_output([sys.argv[1],':memory:',sql],text=True).strip().split('|')
  rows.append(dict(hex=h,storage=storage,expected=expected))
# Exact ambiguous binary controls plus nonminimal admission, not wrappers for witness.
for h in ['33343536','7b695c755a5a5a5a','cb08695c755a5a5a5a','c90e5c0a5c75643830305c7574633030','233165']:
 x=f"x'{h}'";sql='select '+','.join(f'json_valid({x},{f})' for f in [1,2,4,8,15])+f',json_error_position({x});'
 rows.append(dict(hex=h,storage='blob',expected=subprocess.check_output([sys.argv[1],':memory:',sql],text=True).strip().split('|')))
json.dump(rows,open(sys.argv[2],'w'),indent=2);print(len(rows),'native cases')
