#!/usr/bin/env python3
"""Native FIRST R5 ready unmatched WHERE input; no runtime import."""
import argparse,importlib.util,json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('h',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output',required=True);args=p.parse_args();d=h.load(args.library)
base=json.loads((root/'test/conformance/cases/repeated-right-full.json').read_text());m=json.loads((root/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
cases=[('scalar-left', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k WHERE (SELECT z.k)=3 ORDER BY 1,2,3'), ('scalar-inner', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 JOIN c z ON z.k=b.k WHERE (SELECT z.k)=3 ORDER BY 1,2,3'), ('exists-left', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k WHERE EXISTS(SELECT 1 WHERE z.k=3) ORDER BY 1,2,3'), ('in-left', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k WHERE 3 IN(SELECT z.k) ORDER BY 1,2,3'), ('rhs-ready', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 JOIN c z ON 1 WHERE (SELECT b.k)=3 ORDER BY 1,2,3'), ('prior-ready', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 JOIN c z ON 1 WHERE (SELECT a.k) IS NULL AND b.k=3 ORDER BY 1,2,3'), ('transitive', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k WHERE (SELECT (SELECT z.k))=3 ORDER BY 1,2,3'), ('local', 'SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 JOIN c z ON 1 WHERE EXISTS(SELECT 1 FROM c z WHERE z.k=3) AND b.k=3 ORDER BY 1,2,3')]
out=[]
for enc in base['fixtures']:
 setup=['PRAGMA encoding='+repr({'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc])]+base['setup']
 for name,sql in cases:
  native=h.capture(d,{'setups':{'base':setup}},dict(sql=sql,setup='base'))
  assert native['prepare']['kind']=='ok' and native['first']['kind']=='done',(enc,name,native)
  out.append(dict(encoding=enc,id=name,sql=sql,native=native))
pathlib.Path(args.output).write_text(json.dumps({'source':base['source'],'cases':out},indent=2)+'\n');print('R5 native FIRST',len(out),'typed rows/all5 metadata')
