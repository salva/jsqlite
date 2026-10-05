#!/usr/bin/env python3
"""Native-FIRST continuation discriminators; development only, no runtime import."""
import argparse, importlib.util, json, pathlib
root=pathlib.Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location('capture',root/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
a=argparse.ArgumentParser();a.add_argument('--library',required=True);a.add_argument('--output',required=True);args=a.parse_args()
d=h.load(args.library);base=json.loads((root/'test/conformance/cases/repeated-right-full.json').read_text());m=json.loads((root/'reference/sqlite/manifest.json').read_text())
assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
join=' FROM a FULL JOIN b ON a.k=b.k FULL JOIN c ON b.k=c.k'
cases=[
 ('merged-group-call','SELECT coalesce(k,99),count(*),sum(k) FROM a FULL JOIN b USING(k) FULL JOIN c USING(k) GROUP BY k ORDER BY 1'),
 ('derived-group-expression','SELECT k,count(*),sum(v) FROM (SELECT coalesce(a.k,b.k,c.k) AS k,coalesce(a.k,b.k,c.k)+1 AS v'+join+') AS j GROUP BY k ORDER BY k'),
 ('derived-filter-admitted','SELECT j.k,j.v FROM (SELECT coalesce(a.k,b.k,c.k) AS k,coalesce(a.k,b.k,c.k)+1 AS v'+join+') AS j WHERE j.v>2'),
 ('derived-filter-expression','SELECT j.k,j.v FROM (SELECT coalesce(a.k,b.k,c.k) AS k,coalesce(a.k,b.k,c.k)+1 AS v'+join+') AS j WHERE j.v>2 ORDER BY j.k'),
 ('limit-zero','SELECT a.k,b.k,c.k'+join+' LIMIT 0'),
 ('limit-drain','SELECT a.k,b.k,c.k'+join+' LIMIT 2 OFFSET 4'),
 ('scalar-stop','SELECT (SELECT c.k'+join+' LIMIT 1 OFFSET 4), 1'),
 ('exists-stop','SELECT EXISTS(SELECT c.k'+join+' WHERE c.k=4), 1'),
 ('compound-limit','SELECT a.k'+join+' UNION ALL SELECT 99 LIMIT 2 OFFSET 4'),
 ('downstream-in','SELECT a.k,b.k,c.k,z.k'+join+' LEFT JOIN c z INDEXED BY c_k ON z.k IN(1,3) AND z.k=c.k ORDER BY c.rowid,b.rowid,a.rowid,z.rowid'),
 ('rhs-index-drain','SELECT a.k,b.k,c.k FROM a FULL JOIN b ON a.k=b.k FULL JOIN c INDEXED BY c_k ON b.k=c.k ORDER BY c.rowid,b.rowid,a.rowid'),
]
out=[]
for enc in base['fixtures']:
 setup=['PRAGMA encoding='+repr({'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc])]+base['setup']
 for name,sql in cases:
  c={'encoding':enc,'id':name,'sql':sql,'setup':'base','rebind':[]}
  native=h.capture(d,{'setups':{'base':setup}},c)
  assert native['prepare']['kind']=='ok' and native['first']['kind']=='done',(enc,name,native)
  out.append(dict(encoding=enc,id=name,sql=sql,native=native))
pathlib.Path(args.output).write_text(json.dumps({'source':base['source'],'cases':out},indent=2)+'\n')
print(f'native continuation capture:{len(out)}/{len(out)}, five metadata fields and typed rows/reset')
