#!/usr/bin/env python3
"""Development-only pinned read-only Chinook indexed throughput capture."""
import ctypes as C, hashlib, importlib.util, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[3]
s=importlib.util.spec_from_file_location('native',root/'test/conformance/capture-multisource-select.py')
h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(sys.argv[1]);pin=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==pin['sqliteSourceId']
p=root/'examples/browser/chinook.sqlite';digest=hashlib.sha256(p.read_bytes()).hexdigest()
assert digest=='7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15'
d.sqlite3_open_v2.argtypes=[C.c_char_p,C.POINTER(h.P),C.c_int,C.c_char_p]
sql='SELECT a.Title AS album,COUNT(*) AS tracks,ROUND(SUM(t.Milliseconds)/60000.0,1) AS total_minutes,ROUND(AVG(t.UnitPrice),2) AS average_price,SUM(CASE WHEN t.Milliseconds>300000 THEN 1 ELSE 0 END) AS tracks_over_5_minutes FROM Album a JOIN Track t ON t.AlbumId=a.AlbumId WHERE a.AlbumId BETWEEN 1 AND 20 GROUP BY a.AlbumId,a.Title HAVING COUNT(*)>=5 ORDER BY total_minutes DESC,album LIMIT 10;'
db=h.P();st=h.P();assert d.sqlite3_open_v2(str(p).encode(),C.byref(db),1,None)==0
try:
 tail=C.c_char_p();raw=sql.encode();assert d.sqlite3_prepare_v2(db,raw,len(raw),C.byref(st),C.byref(tail))==0
 n=d.sqlite3_column_count(st)
 fields=['name','declaredType','database','table','origin']
 fns=[d.sqlite3_column_name,d.sqlite3_column_decltype,d.sqlite3_column_database_name,d.sqlite3_column_table_name,d.sqlite3_column_origin_name]
 metadata=[dict(zip(fields,[h.txt(fn,st,i) for fn in fns])) for i in range(n)]
 rc,rows=h.rows(d,st,n);assert rc==101
 assert d.sqlite3_reset(st)==0
 rc,again=h.rows(d,st,n);assert rc==101 and again==rows
 print(json.dumps({'sourceId':pin['sqliteSourceId'],'fixtureSha256':digest,'sql':sql,'metadata':metadata,'rows':rows},indent=2))
finally:
 assert d.sqlite3_finalize(st)==0
 assert d.sqlite3_close(db)==0
