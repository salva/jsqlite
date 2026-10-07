#!/usr/bin/env python3
"""Development-only read-only oracle corruption companions, after dormant wiring.
Original immutable fixtures unchanged; capture before case-driven runtime repairs.
"""
import argparse,ctypes as C,importlib.util,json,pathlib,hashlib,sys
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',ROOT/'test/conformance/capture-index-planner.py');n=importlib.util.module_from_spec(s);s.loader.exec_module(n)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output-dir',required=True);a=p.parse_args()
d=n.load(a.library);pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
d.sqlite3_errmsg.argtypes=[C.c_void_p];d.sqlite3_errmsg.restype=C.c_char_p
CALLBACK=C.CFUNCTYPE(C.c_int);d.sqlite3_progress_handler.argtypes=[C.c_void_p,C.c_int,CALLBACK,C.c_void_p]
out=pathlib.Path(a.output_dir);out.mkdir(parents=True,exist_ok=True);variants=[]
base=ROOT/'docs/research/card-s-g/primitive-companions';captured=json.loads((base/'native.json').read_text())
for v in captured['variants']:
 if v['tail']!='18':continue
 original=base/v['fixture'];raw=original.read_bytes();assert hashlib.sha256(raw).hexdigest()==v['sha256']
 db=C.c_void_p();assert d.sqlite3_open_v2(str(original).encode(),C.byref(db),1,None)==0
 roots,_=n.query(d,db,"SELECT name,rootpage FROM sqlite_schema WHERE type='index'");roots={bytes.fromhex(r[0]['utf8Hex']).decode():int(r[1]['value']) for r in roots};assert d.sqlite3_close(db)==0
 page_size=int.from_bytes(raw[16:18],'big');root=roots['ab'];offset=(root-1)*page_size;assert raw[offset]==2
 # Child pointer of first interior cell; all mutation descriptions retain exact offsets.
 cell_offset=int.from_bytes(raw[offset+12:offset+14],'big');child=int.from_bytes(raw[offset+cell_offset:offset+cell_offset+4],'big');assert child>1
 leaf=child
 while raw[(leaf-1)*page_size]==2:
  o=(leaf-1)*page_size;cell=int.from_bytes(raw[o+12:o+14],'big');leaf=int.from_bytes(raw[o+cell:o+cell+4],'big')
 assert raw[(leaf-1)*page_size]==10
 last_leaf=root
 while raw[(last_leaf-1)*page_size]==2:
  o=(last_leaf-1)*page_size;last_leaf=int.from_bytes(raw[o+8:o+12],'big')
 assert raw[(last_leaf-1)*page_size]==10
 assert raw[offset+cell_offset+4]<128 # local single-byte payload length
 for kind,pos,replacement in [('interior-child',offset+cell_offset,b'\0'*4),('selected-leaf',(leaf-1)*page_size,b'\xff'),('offpath-index',(roots['ad']-1)*page_size,b'\xff'),('interior-record',offset+cell_offset+5,b'\xff'),('late-leaf',(last_leaf-1)*page_size,b'\xff'),('interior-payload-size',offset+cell_offset+4,b'\x7f'),('interior-serial-type',offset+cell_offset+6,b'\x0b')]:
  data=bytearray(raw);old=bytes(data[pos:pos+len(replacement)]);data[pos:pos+len(replacement)]=replacement
  file=out/f"{v['encoding'].lower()}-{kind}.db";assert not file.exists();file.write_bytes(data)
  db=C.c_void_p();assert d.sqlite3_open_v2(str(file).encode(),C.byref(db),1,None)==0
  sql='SELECT b FROM t INDEXED BY ab WHERE b=7';eqp=n.explain(d,db,'EXPLAIN QUERY PLAN ',sql,());assert any('ANY(' in line for line in eqp),eqp
  st=C.c_void_p();assert d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0
  ticks=[];cb=CALLBACK(lambda:(ticks.append(1) or int(len(ticks)>1000)));d.sqlite3_progress_handler(db,100,cb,None)
  rows=[]
  while True:
   rc=d.sqlite3_step(st)
   if rc!=100:break
   rows.append([n.cell(d,st,0)])
  error=None if rc==101 else d.sqlite3_errmsg(db).decode();reset=d.sqlite3_reset(st);finalize=d.sqlite3_finalize(st);assert d.sqlite3_close(db)==0
  expected=101 if kind=='offpath-index' else 9 if kind=='interior-serial-type' else 11;assert rc==expected,(kind,rc,error)
  if kind=='late-leaf':assert len(rows)>0, 'must reach rows before late failure'
  variants.append({'encoding':v['encoding'],'kind':kind,'fixture':file.name,'sha256':hashlib.sha256(data).hexdigest(),'originalSha256':v['sha256'],'mutation':{'offset':pos,'oldHex':old.hex(),'newHex':replacement.hex(),'root':root,'leaf':leaf},'sql':sql,'eqp':eqp,'rows':rows,'stepRc':rc,'error':error,'resetRc':reset,'finalizeRc':finalize})
(out/'native.json').write_text(json.dumps({'sourceId':pin['sqliteSourceId'],'chronology':'new payload companions before any case-driven runtime repair; serial-type11 is bounded native interrupt9, not corrupt11 evidence','variants':variants},indent=2)+'\n');print('PASS:21 read-only native corruption/offpath captures')
