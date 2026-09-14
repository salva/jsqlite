#!/usr/bin/env python3
import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
pkg=json.loads((root/'package.json').read_text())
assert pkg.get('private') is True
for key in ('main','module','browser','bin','files','exports'):
 assert key not in pkg, f'private contract package unexpectedly publishes {key}'
for p in (root/'src').rglob('*.ts'):
 text=p.read_text()
 assert not re.search(r'(tools/oracle|test/fixtures|sqlite3-oracle|child_process|node:fs)',text), f'native/development boundary leak in {p}'
 assert not re.search(r'\beval\s*\(',text), f'runtime eval is forbidden in {p}'
 assert not re.search(r'\bFunction\s*\(',text), f'runtime Function constructor is forbidden in {p}'
print('package boundary passed: private, no publish surface, no runtime native/tool/fixture imports or dynamic code generation')
