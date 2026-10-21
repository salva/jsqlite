"""Development-only native expectations for the public beta regression controls."""
import argparse,ctypes as C,hashlib,importlib.util,json,pathlib,struct,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--library',required=True);args=p.parse_args()
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('capture',ROOT/'test/conformance/capture-index-planner.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture);lib=capture.load(args.library)
pin=json.loads((ROOT/'reference/sqlite/manifest.json').read_text());assert lib.sqlite3_sourceid().decode()==pin['sqliteSourceId']
lib.sqlite3_column_name.argtypes=[C.c_void_p,C.c_int];lib.sqlite3_column_name.restype=C.c_char_p
fixture=ROOT/'examples/browser/chinook.sqlite';db=C.c_void_p();assert lib.sqlite3_open_v2(str(fixture).encode(),C.byref(db),1,None)==0
sqls=[
 ('metadata-group','SELECT name,count(*) AS n FROM pragma_table_info(\'Album\') GROUP BY name ORDER BY name'),
 ('recursive-right','WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3) SELECT q.x,a.AlbumId FROM q RIGHT JOIN Album a ON a.AlbumId=q.x WHERE a.AlbumId<=3 ORDER BY a.AlbumId'),
 ('json-right',"SELECT a.AlbumId,j.value FROM Album a RIGHT JOIN json_each('[1,2,9999]') j ON a.AlbumId=j.value ORDER BY j.key"),
 ('metadata-aggregate-join',"SELECT a.AlbumId,count(p.cid) AS n FROM Album a LEFT JOIN pragma_table_info('Album') p ON p.cid>=0 WHERE a.AlbumId<=3 GROUP BY a.AlbumId ORDER BY a.AlbumId"),
 ('metadata-window-join',"SELECT a.AlbumId,p.name,row_number() OVER (ORDER BY a.AlbumId) AS rn FROM Album a JOIN pragma_table_info('Album') p ON p.cid=0 WHERE a.AlbumId<=3 ORDER BY a.AlbumId"),
 ('numeric-separator-production',"SELECT 1_000 AS i, 1_2.5 AS r, 0x1_0 AS h"),
]
def cell(x):
 k=x['type'];v=None if k=='null' else struct.unpack('>d',bytes.fromhex(x['ieee754be']))[0] if k=='real' else bytes.fromhex(x['utf8Hex']).decode() if k=='text' else x.get('value',x.get('hex'))
 return {'type':k,'value':v}
cases=[]
try:
 for name,sql in sqls:
  st=C.c_void_p();assert lib.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None)==0,name
  try:
   columns=[lib.sqlite3_column_name(st,i).decode() for i in range(lib.sqlite3_column_count(st))];runs=[]
   for _ in range(2):
    rows=[]
    while (rc:=lib.sqlite3_step(st))==100:rows.append([cell(capture.cell(lib,st,i)) for i in range(len(columns))])
    assert rc==101;assert lib.sqlite3_reset(st)==0;runs.append(rows)
   assert runs[0]==runs[1];cases.append({'id':name,'sql':sql,'columns':columns,'rows':runs[0]})
  finally:assert lib.sqlite3_finalize(st)==0
finally:assert lib.sqlite3_close(db)==0
out={'sourceId':pin['sqliteSourceId'],'fixtureSha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'librarySha256':hashlib.sha256(pathlib.Path(args.library).read_bytes()).hexdigest(),'resetRuns':2,'cases':cases}
(ROOT/'test/browser/public-beta-native.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(f'Captured {len(cases)} beta controls with two native reset runs each')
