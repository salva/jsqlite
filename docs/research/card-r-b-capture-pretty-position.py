"""Pinned 3.53.4 pretty/plain renderer consumed-position capture (development only)."""
import ctypes as c,hashlib,json,pathlib,sys
lib=pathlib.Path(sys.argv[1]);l=c.CDLL(str(lib));P=c.c_void_p
spec=[('sqlite3_sourceid',[],c.c_char_p),('sqlite3_open',[c.c_char_p,c.POINTER(P)],c.c_int),('sqlite3_exec',[P,c.c_char_p,P,P,P],c.c_int),('sqlite3_prepare_v2',[P,c.c_char_p,c.c_int,c.POINTER(P),P],c.c_int),('sqlite3_bind_blob',[P,c.c_int,P,c.c_int,P],c.c_int),('sqlite3_step',[P],c.c_int),('sqlite3_column_type',[P,c.c_int],c.c_int),('sqlite3_column_int64',[P,c.c_int],c.c_int64),('sqlite3_column_text',[P,c.c_int],P),('sqlite3_column_bytes',[P,c.c_int],c.c_int),('sqlite3_errmsg',[P],c.c_char_p),('sqlite3_reset',[P],c.c_int),('sqlite3_finalize',[P],c.c_int),('sqlite3_close',[P],c.c_int)]
for name in ['name','decltype','database_name','table_name','origin_name']:spec.append(('sqlite3_column_'+name,[P,c.c_int],c.c_char_p))
for n,a,r in spec:f=getattr(l,n);f.argtypes=a;f.restype=r
source=l.sqlite3_sourceid().decode();assert source=='2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc'
hexes={'2B1000','2B1100','2B1200','2B0000','00','01','02','1000','1100','1200','C000','C100','C200','0B','0C','3B133100','3B176100','4C17610000','4B2B100000','3B1B1000','4B1B100000','4C10000000','4C11000000','4C12000000','4C0B000000','4C0C000000','5C1B10000000','5C1C10000000','5C2B10000000','4C27100000','3B170000','3B180000','3B190000','3B1A0000','3B133100','3B153100','2B1300','2B1700','2B0F00','3BC00000','4BC1000000','4BDC000000','4BDB000000','3BD00000'}
# Minimal/nonminimal boolean/null headers, all payload sizes that fit. Each
# byte remains a reached sibling, including reserved/truncated/different tags.
for tag in range(3):
 for size in [0,1,2,3]:
  payload=bytes([size*16+tag])+bytes(size)
  hexes.add((bytes([len(payload)*16+11])+payload).hex().upper())
 for h in [bytes([0xc0+tag,1]),bytes([0xd0+tag,0,1]),bytes([0xe0+tag,0,0,0,1])]:
  payload=h+b'\0';hexes.add((bytes([len(payload)*16+11])+payload).hex().upper())
 for tail in ['01','02','0B','0C','1331','1761','0F','C0']:
  payload=bytes([0x10+tag])+bytes.fromhex(tail)
  hexes.add((bytes([len(payload)*16+11])+payload).hex().upper())
expressions=['json_pretty(?1)','json_pretty(?1,\'\')','json(?1)','json_valid(?1,4)','json_valid(?1,8)','json_error_position(?1)']
rows=[]
for enc in ['utf8','utf16le','utf16be']:
 db=P();assert l.sqlite3_open(b':memory:',c.byref(db))==0
 assert l.sqlite3_exec(db,('PRAGMA encoding='+{'utf8':"'UTF-8'",'utf16le':"'UTF-16le'",'utf16be':"'UTF-16be'"}[enc]).encode(),None,None,None)==0
 for hex in sorted(hexes):
  b=bytes.fromhex(hex);buf=c.create_string_buffer(b)
  for expr in expressions:
   s=P();assert l.sqlite3_prepare_v2(db,('SELECT '+expr).encode(),-1,c.byref(s),None)==0
   meta={n:(getattr(l,'sqlite3_column_'+n)(s,0) or b'').decode() or None for n in ['name','decltype','database_name','table_name','origin_name']}
   assert l.sqlite3_bind_blob(s,1,buf,len(b),None)==0
   results=[]
   for _ in range(2):
    rc=l.sqlite3_step(s)
    if rc==100:
     typ=l.sqlite3_column_type(s,0)
     if typ==3:result=dict(type='text',value=c.string_at(l.sqlite3_column_text(s,0),l.sqlite3_column_bytes(s,0)).decode())
     else:assert typ==1;result=dict(type='integer',value=str(l.sqlite3_column_int64(s,0)))
     assert l.sqlite3_step(s)==101
    else:result=dict(error=l.sqlite3_errmsg(db).decode(),code=rc)
    results.append(result);l.sqlite3_reset(s)
   assert results[0]==results[1];l.sqlite3_finalize(s)
   rows.append(dict(enc=enc,hex=hex,expression=expr,metadata=meta,result=results[0]))
 assert l.sqlite3_close(db)==0
out=dict(source=source,library_sha256=hashlib.sha256(lib.read_bytes()).hexdigest(),cases=len(hexes),statements=len(rows),repetitions=2,rows=rows)
pathlib.Path(sys.argv[2]).write_text(json.dumps(out,indent=2)+'\n');print(len(hexes),len(rows),hashlib.sha256(pathlib.Path(sys.argv[2]).read_bytes()).hexdigest())
