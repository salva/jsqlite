#!/usr/bin/env python3
"""Pin physical stat1 record-header damage; mutate only a copied immutable fixture."""
import argparse, hashlib, json, pathlib
import importlib.util
MODULE=pathlib.Path(__file__).with_name("stat-record-boundary.py")
spec=importlib.util.spec_from_file_location("stat_records",MODULE)
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
ROOT=r.ROOT
OUT=ROOT/"test/conformance/cases/stat-record-corruption.json"
def capture(library,regenerate=False):
 d=r.m.load(library);r.base.cap.identity(d)
 variants=[]
 for enc in ("utf8","utf16le","utf16be"):
  source=ROOT/f"test/conformance/fixtures/in-range-stat-{enc}-after.db"
  db=r.base.cap.open_db(d,source,True)
  try:
   root=int(r.m.query(d,db,"SELECT rootpage FROM sqlite_schema WHERE name='sqlite_stat1'")[0][0][0]["value"])
  finally:d.sqlite3_close(db)
  raw=source.read_bytes();size=int.from_bytes(raw[16:18],"big") or 65536;page=(root-1)*size
  assert raw[page]==13 and int.from_bytes(raw[page+3:page+5],"big")==3
  # Last leaf cell contains the t_a row; first contains t_ab. Replace the
  # serial-type varint byte (third byte of the record header) with a reserved
  # type 0x7f requiring more bytes than available in its record.
  for kind,cell_number in (("selected-t_a",2),("offpath-t_ab",0)):
   cell=int.from_bytes(raw[page+8+2*cell_number:page+10+2*cell_number],"big")
   assert cell>0 and cell<size
   offset=page+cell+2+2
   assert raw[offset]>=13 and raw[offset]%2==1 and raw[offset]<0x7f, (enc,kind,raw[offset])
   target=ROOT/f"test/conformance/fixtures/stat-corrupt-{enc}-{kind}.db"
   if regenerate:
    damaged=bytearray(raw);damaged[offset]=0x7f;target.write_bytes(damaged)
   damaged=target.read_bytes();assert damaged[:offset]==raw[:offset] and damaged[offset]==0x7f and damaged[offset+1:]==raw[offset+1:]
   db=r.base.cap.open_db(d,target,True)
   try:
    cases={}
    for name,sql in r.base.SQL.items():
     rows,_=r.m.query(d,db,sql);eqp=r.m.explain(d,db,"EXPLAIN QUERY PLAN ",sql,())
     cases[name]={"rows":rows,"eqp":eqp}
   finally:d.sqlite3_close(db)
   variants.append({"encoding":enc,"kind":kind,"fixture":str(target.relative_to(ROOT)),"offset":offset,"sha256":hashlib.sha256(damaged).hexdigest(),"native":cases})
 return {"sourceId":r.base.SOURCE["sqliteSourceId"],"sql":r.base.SQL,"variants":variants}
if __name__=="__main__":
 a=argparse.ArgumentParser();a.add_argument("--library",required=True);a.add_argument("--regenerate",action="store_true");args=a.parse_args()
 result=capture(args.library,args.regenerate)
 if args.regenerate:OUT.write_text(json.dumps(result,indent=2)+"\n")
 else:assert result==json.loads(OUT.read_text()),"read-only corruption capture differs"
 print("pinned read-only stat1 corrupted headers match:",len(result["variants"]))
