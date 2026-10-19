"""Development-only capture; pass the pinned oracle .so path as argv[1]."""
import ctypes as c
import json
import pathlib
import sys
lib=c.CDLL(sys.argv[1]);P=c.c_void_p
for name,args,ret in [('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_text',[P,c.c_int],c.c_char_p),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int),('sqlite3_sourceid',[],c.c_char_p)]:
 f=getattr(lib,name);f.argtypes=args;f.restype=ret
sqls=["json_extract('[]','$[#-1x]')","json_set('[]','$[#-1x]',1)","json_extract('[0]','$[#-2x]')","json_extract('[0]','$[#-1x]')","json_extract('[0]','$[#-0x]')","json_extract('[0]','$[#-1]')"]
for doc in ['[]','[0]','[0,1]','{}','0']:
 for tail in ['#-0x]','#-1x]','#-2x]','#-3x]','#-1','#-1].','#-0]','#-1]','#-2]','#-3]','#]','#x]','#-]','#-x]','0x]','1x]','0]','00]','1]','2]','4294967295]','999999999999999999999999999999999999]','#-999999999999999999999999999999999999x]']:
  p='$['+tail
  sqls.extend([f"json_extract('{doc}','{p}')",f"json_set('{doc}','{p}',9)"])
# Every shared scalar consumer, plus sequential edit and missing-substructure.
for p in ['$[#-3x]','$[#-2x]','$[#-1x]','$[#-0x]','$[#-3].','$[#-2].']:
 sqls.extend([f"json_type('[0,1]','{p}')",f"json_array_length('[0,1]','{p}')",f"'[0,1]' -> '{p}'",f"'[0,1]' ->> '{p}'",f"json_remove('[0,1]','{p}')",f"json_insert('[0,1]','{p}',9)",f"json_replace('[0,1]','{p}',9)",f"json_array_insert('[0,1]','{p}',9)",f"jsonb_extract(jsonb('[0,1]'),'{p}')",f"hex(jsonb_set(jsonb('[0,1]'),'{p}',9))",f"hex(jsonb_remove(jsonb('[0,1]'),'{p}'))"])
sqls.extend(["json_set('{}','$.a[#-1x]',9)","json_set('{}','$.a[#-0x]',9)","json_set('[]','$[#-1x]',9,'$[#]',2)"])
db=P();assert lib.sqlite3_open(b':memory:',c.byref(db))==0
rows=[]
for q in dict.fromkeys(sqls):
 s=P();rc=lib.sqlite3_prepare_v2(db,('SELECT '+q).encode(),-1,c.byref(s),None)
 if rc==0:rc=lib.sqlite3_step(s)
 r={'expression':q,'rc':rc}
 if rc==100:
  r['type']=lib.sqlite3_column_type(s,0);v=lib.sqlite3_column_text(s,0);r['value']=v.decode() if v is not None else None
 else:r['error']=lib.sqlite3_errmsg(db).decode()
 rows.append(r);lib.sqlite3_finalize(s)
lib.sqlite3_close(db)
result={'sourceId':lib.sqlite3_sourceid().decode(),'cases':rows}
pathlib.Path(__file__).with_name('card-r-b-from-end-native.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['sourceId'],len(rows),'cases')
