import importlib.util,ctypes as C,json,pathlib
s=importlib.util.spec_from_file_location('c','test/conformance/capture-index-planner.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
d=m.load('.saivage/work/cards/card-c-b/oracle-build/build/libsqlite3-oracle.so')
cap=json.load(open('test/conformance/cases/row-width-native.json')); out=[]
values=[1.0,1.5,9007199254740992.0,9223372036854775808.0,-9223372036854775808.0,'1','1.0','1.5','abc',None,'9223372036854775808','9007199254740993.0']
for v in cap['variants']:
 if v['state']!='before':continue
 db=C.c_void_p();assert d.sqlite3_open_v2(v['fixture'].encode(),C.byref(db),1,None)==0
 for value in values:
  rows,counters=m.query(d,db,'SELECT id,typeof(?1),?1 FROM t WHERE id=?1 LIMIT 4',[value]);out.append(dict(encoding=v['encoding'],fixture=v['fixture'],value=value,counters=counters,rows=rows))
 d.sqlite3_close(db)
pathlib.Path('test/conformance/cases/seek-rowid-numeric-native.json').write_text(json.dumps(out,indent=2)+'\n')
print('native first: 36 typed boundary queries')
