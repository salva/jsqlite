#!/usr/bin/env python3
"""Pinned public-C oracle for derived window output scope (no TS credit)."""
import argparse, ctypes as C, hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'reference/sqlite/manifest.json').read_text())
fixture_contract=json.loads((ROOT/'test/fixtures/public/chinook.json').read_text())
P=C.c_void_p

def load(path):
    lib=C.CDLL(path)
    signatures={
      'sqlite3_libversion':([],C.c_char_p),'sqlite3_sourceid':([],C.c_char_p),
      'sqlite3_open_v2':([C.c_char_p,C.POINTER(P),C.c_int,C.c_char_p],C.c_int),
      'sqlite3_close':([P],C.c_int),'sqlite3_errmsg':([P],C.c_char_p),
      'sqlite3_prepare_v2':([P,C.c_char_p,C.c_int,C.POINTER(P),C.POINTER(C.c_char_p)],C.c_int),
      'sqlite3_bind_int64':([P,C.c_int,C.c_longlong],C.c_int),'sqlite3_step':([P],C.c_int),
      'sqlite3_finalize':([P],C.c_int),'sqlite3_column_int64':([P,C.c_int],C.c_longlong),
      'sqlite3_column_text':([P,C.c_int],C.c_void_p),'sqlite3_column_bytes':([P,C.c_int],C.c_int),
    }
    for name,(args,result) in signatures.items(): fn=getattr(lib,name);fn.argtypes=args;fn.restype=result
    return lib

def text(lib,statement,column):
    pointer=lib.sqlite3_column_text(statement,column)
    return C.string_at(pointer,lib.sqlite3_column_bytes(statement,column)).decode() if pointer else None

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--library',required=True);parser.add_argument('--database',required=True);args=parser.parse_args()
    image=Path(args.database).read_bytes()
    assert len(image)==fixture_contract['bytes']
    assert hashlib.sha256(image).hexdigest()==fixture_contract['sha256']
    lib=load(args.library)
    assert lib.sqlite3_libversion().decode()==manifest['version']
    assert lib.sqlite3_sourceid().decode()==manifest['sqliteSourceId']
    db=P();assert lib.sqlite3_open_v2(str(Path(args.database).resolve()).encode(),C.byref(db),1,None)==0
    try:
      invalid=[
        'SELECT Name,row_number() OVER (ORDER BY Bytes DESC) AS rk FROM Track WHERE rk<=?1',
        'SELECT Name,row_number() OVER (ORDER BY Bytes DESC) AS rk FROM Track GROUP BY Name HAVING rk<=?1',
      ]
      diagnostics=[]
      for sql in invalid:
        statement=P();rc=lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(statement),None)
        diagnostics.append({'prepareRc':rc,'message':lib.sqlite3_errmsg(db).decode(),'statementPublished':bool(statement.value)})
        if statement.value: lib.sqlite3_finalize(statement)
      assert diagnostics==[{'prepareRc':1,'message':'misuse of aliased window function rk','statementPublished':False}]*2
      sql='SELECT * FROM (SELECT Name,row_number() OVER (ORDER BY Bytes DESC) AS rk FROM Track) WHERE rk<=?1 ORDER BY rk DESC LIMIT ?2'
      statement=P();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(statement),None)==0 and statement.value
      try:
        assert lib.sqlite3_bind_int64(statement,1,5)==0;assert lib.sqlite3_bind_int64(statement,2,5)==0
        rows=[]
        while True:
          rc=lib.sqlite3_step(statement)
          if rc==101: break
          assert rc==100,lib.sqlite3_errmsg(db).decode()
          rows.append([text(lib,statement,0),lib.sqlite3_column_int64(statement,1)])
        assert rows==[['Dave',5],['The Man With Nine Lives',4],['The Young Lords',3],['Occupation / Precipice',2],['Through a Looking Glass',1]]
      finally: assert lib.sqlite3_finalize(statement)==0
      print(json.dumps({'version':manifest['version'],'sourceId':manifest['sqliteSourceId'],'fixture':{'bytes':len(image),'sha256':fixture_contract['sha256']},'diagnostics':diagnostics,'rows':rows},separators=(',',':')))
    finally: assert lib.sqlite3_close(db)==0
if __name__=='__main__': main()
