import importlib.util,json,pathlib,os
import argparse
a=argparse.ArgumentParser();a.add_argument('--library',required=True);args=a.parse_args()
r=pathlib.Path(__file__).resolve().parents[2];s=importlib.util.spec_from_file_location('h',r/'test/conformance/capture-multisource-select.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
d=h.load(args.library);c=json.loads((r/'test/conformance/cases/repeated-right-full.json').read_text());m=json.loads((r/'reference/sqlite/manifest.json').read_text());assert d.sqlite3_sourceid().decode()==m['sqliteSourceId'];assert d.sqlite3_libversion().decode()==m['version']
for enc in c['fixtures']:
 case=next(x for x in c['cases'] if x['encoding']==enc and x['id']=='aggregate');setup=['PRAGMA encoding='+repr({'utf8':'UTF-8','utf16le':'UTF-16le','utf16be':'UTF-16be'}[enc])]+c['setup'];actual=h.capture(d,{'setups':{'base':setup}},dict(case,setup='base'));assert actual==case['native'],(enc,actual,case['native'])
print('R2 existing native-FIRST aggregate discriminator independently recaptured3/3 byte-structure identical (typed rows/all5 metadata)')
