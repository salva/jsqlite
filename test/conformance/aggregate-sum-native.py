#!/usr/bin/env python3
"""Pinned SQLite 3.53.4 differentiators for compensated sum/avg/total."""
import ctypes as C,json,pathlib,struct,sys,importlib.util
module_path=pathlib.Path(__file__).with_name('capture-aggregate-group.py');spec=importlib.util.spec_from_file_location('capture_aggregate_group',module_path);capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
load,OK,ROW,DONE,P,cell=capture.load,capture.OK,capture.ROW,capture.DONE,capture.P,capture.cell
SOURCE_ID="2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc"
QUERIES=[
"SELECT typeof(sum(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END)),sum(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END),avg(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END),total(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END) FROM t1 WHERE x<3",
"SELECT typeof(sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END)),sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END),avg(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END),total(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END) FROM t1 WHERE x<3",
"SELECT sum(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END),avg(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END),total(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END) FROM t1 WHERE x<3",
"SELECT sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 END) FROM t1 WHERE x<2"]
EXPECTED=[[{'type':'text','utf8Hex':'7265616c'},{'type':'real','ieee754be':'3ff0000000000000'},{'type':'real','ieee754be':'3fd5555555555555'},{'type':'real','ieee754be':'3ff0000000000000'}],[{'type':'text','utf8Hex':'7265616c'},{'type':'real','ieee754be':'43e0000000000000'},{'type':'real','ieee754be':'43c5555555555555'},{'type':'real','ieee754be':'43e0000000000000'}],[{'type':'real','ieee754be':'3ff0000000000000'},{'type':'real','ieee754be':'3fd5555555555555'},{'type':'real','ieee754be':'3ff0000000000000'}]]
def main():
 d=load(sys.argv[1]);assert d.sqlite3_sourceid().decode()==SOURCE_ID
 root=pathlib.Path('test/fixtures/generations/g-88a5ac73e417de7fb7eddad79134d3dbfa74ae2e5c2b430b495187e173b01412/generated/expr-relational.db');db=P();assert d.sqlite3_open_v2(str(root).encode(),C.byref(db),1,None)==OK
 try:
  for index,q in enumerate(QUERIES):
   s=P();tail=C.c_char_p();raw=q.encode();assert d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(s),C.byref(tail))==OK
   try:
    rc=d.sqlite3_step(s)
    if index<3:assert rc==ROW and [cell(d,s,i) for i in range(d.sqlite3_column_count(s))]==EXPECTED[index] and d.sqlite3_step(s)==DONE
    else:assert rc==1 and d.sqlite3_errmsg(db).decode()=='integer overflow'
   finally:d.sqlite3_finalize(s)
 finally:d.sqlite3_close(db)
 print('aggregate SumCtx native differentiators: 4/4')
main()
