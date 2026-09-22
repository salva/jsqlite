#!/usr/bin/env python3
"""Manifest-pinned SQLite oracle for expression-subquery Chinook cases."""
import argparse, ctypes as C, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
fixture=json.loads((ROOT/'test/fixtures/public/chinook.json').read_text())
P=C.c_void_p

def main():
 p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--database',required=True);a=p.parse_args();image=Path(a.database).read_bytes();assert len(image)==fixture['bytes'];assert hashlib.sha256(image).hexdigest()==fixture['sha256']
 lib=C.CDLL(a.library);spec={'sqlite3_sourceid':([],C.c_char_p),'sqlite3_open_v2':([C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),'sqlite3_close':([P],C.c_int),'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),'sqlite3_step':([P],C.c_int),'sqlite3_finalize':([P],C.c_int),'sqlite3_column_count':([P],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong)}
 for n,(args,result) in spec.items():f=getattr(lib,n);f.argtypes=args;f.restype=result
 source=lib.sqlite3_sourceid().decode();assert source==manifest['sqliteSourceId'],(source,manifest['sqliteSourceId']);db=P();assert lib.sqlite3_open_v2(str(Path(a.database).resolve()).encode(),C.byref(db),1,None)==0
 queries={'A1':'SELECT (SELECT count(*) FROM Genre),(SELECT count(*) FROM MediaType)','B4':'SELECT count(*) FROM Track t WHERE EXISTS(SELECT 1 FROM InvoiceLine il JOIN Invoice i ON i.InvoiceId=il.InvoiceId WHERE il.TrackId=t.TrackId)'};out={}
 try:
  for key,sql in queries.items():
   s=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(s),None)==0 and s.value;rows=[]
   try:
    while True:
     rc=lib.sqlite3_step(s)
     if rc==101:break
     assert rc==100
     rows.append([lib.sqlite3_column_int64(s,i) for i in range(lib.sqlite3_column_count(s))])
   finally:assert lib.sqlite3_finalize(s)==0
   out[key]=rows
 finally:assert lib.sqlite3_close(db)==0
 print(json.dumps({'sourceId':source,'fixtureSha256':fixture['sha256'],'rows':out},separators=(',',':')))
if __name__=='__main__':main()
