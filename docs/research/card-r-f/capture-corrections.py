import os,json
base=open('docs/research/card-r-f/capture.py').read();base=base[:base.index('for item in json.load')];exec(base)
inputs=[]
for q in ["'",'"']:
 for content in [r'\x41',r'\v',r'\0',r"a\'b",r'\u0041\/\n', 'a\\\nb',r'\q',r'\xG1',r'\01']:
  doc=q+content+q
  for document in [doc,'{'+doc+':'+doc+'}']:
   for wrap in ['', 'jsonb']:
    literal="'"+document.replace("'","''")+"'"
    sql='SELECT json_pretty('+(f'jsonb({literal})' if wrap else literal)+')'
    s=P();assert L.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)==0
    rc=L.sqlite3_step(s)
    assert L.sqlite3_column_name(s,0).decode()==sql[7:]
    assert rc in (100,1)
    if rc==100:assert L.sqlite3_column_type(s,0)==3
    item={'sql':sql,'type':'text','value':L.sqlite3_column_text(s,0).decode()} if rc==100 else {'sql':sql,'error':'malformed JSON'}
    inputs.append(item);assert L.sqlite3_finalize(s)==(0 if rc==100 else 1)
assert inputs==json.load(open('docs/research/card-r-f/correction-cases.json'))
for item in inputs:print(json.dumps({'column':item['sql'][7:],**item}))
print('captured',len(inputs));L.sqlite3_close(d)
