#!/usr/bin/env python3
"""Native FIRST R6 matched outer WHERE input; no runtime import."""
import argparse,importlib.util,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('h',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);args=p.parse_args();d=h.load(args.library)
base=json.loads((root/'test/conformance/cases/repeated-right-full.json').read_text());m=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
cases=[('right-inner', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=b.k JOIN c z ON 1 WHERE b.rowid=2 ORDER BY 1,2,3'), ('full-inner', 'SELECT a.k,b.k,z.k FROM a FULL JOIN b ON a.k=b.k JOIN c z ON 1 WHERE b.rowid=2 ORDER BY 1,2,3'), ('full-left', 'SELECT a.k,b.k,z.k FROM a FULL JOIN b ON a.k=b.k LEFT JOIN c z ON z.k=b.k WHERE b.rowid=2 ORDER BY 1,2,3'), ('retention', 'SELECT a.k,b.k,z.k FROM a FULL JOIN b ON a.k=b.k JOIN c z ON 1 WHERE a.k IS NULL ORDER BY 1,2,3'), ('ltorj', 'SELECT a.k,b.k,z.k FROM a FULL JOIN b ON a.k=b.k RIGHT JOIN c z ON b.k=z.k WHERE b.rowid=2 ORDER BY 1,2,3'), ('scalar', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=b.k LEFT JOIN c z ON z.k=b.k WHERE (SELECT z.k)=3 ORDER BY 1,2,3'), ('exists', 'SELECT a.k,b.k,z.k FROM a FULL JOIN b ON a.k=b.k LEFT JOIN c z ON z.k=b.k WHERE EXISTS(SELECT 1 WHERE z.k=3) ORDER BY 1,2,3'), ('left-null', 'SELECT a.k,b.k,z.k FROM a LEFT JOIN b ON a.k=-1 JOIN c z ON 1 WHERE b.k IS NULL ORDER BY 1,2,3')]
out=[]
for enc in base['fixtures']:
 setup=['PRAGMA encoding='+repr({'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc])]+base['setup']
 for name,sql in cases:
  native=h.capture(d,{'setups':{'base':setup}},dict(sql=sql,setup='base'))
  assert native['prepare']['kind']=='ok' and native['first']['kind']=='done',(enc,name,native)
  out.append(dict(encoding=enc,id=name,sql=sql,native=native))
pathlib.Path(args.output).write_text(json.dumps({'source':base['source'],'cases':out},indent=2)+'\n');print('R6 native FIRST',len(out),'typed rows/all5 metadata')
