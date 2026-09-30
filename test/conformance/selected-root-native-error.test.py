"""Pinned native selected-root failure versus off-path scan, six immutable snapshots.

Only the disposable byte copy is corrupted. The captured fixture stays unchanged.
"""
import ctypes as C, hashlib, importlib.util, json, os, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=importlib.util.spec_from_file_location('producer',ROOT/'test/conformance/capture-in-range-stat.py')
producer=importlib.util.module_from_spec(p);p.loader.exec_module(producer)
m=producer.m
cap=json.loads((ROOT/'test/conformance/cases/in-range-stat-native.json').read_text())
class SelectedRootFailure(unittest.TestCase):
 def test_readonly_native_corruption_and_cleanup(self):
  root=os.environ.get('SAIVAGE_CARD_WORK_ROOT')
  if not root: self.fail('card work root required for disposable corrupted snapshots')
  work=pathlib.Path(root)/'selected-root-corruption';work.mkdir(parents=True,exist_ok=True)
  library=os.environ.get('SQLITE_ORACLE_LIBRARY')
  if not library:self.fail('SQLITE_ORACLE_LIBRARY must point to manifest-pinned native SQLite')
  d=m.load(library)
  producer.identity(d)
  for v in cap['variants']:
   with self.subTest(encoding=v['encoding'],state=v['state']):
    original=(ROOT/v['fixture']).read_bytes()
    self.assertEqual(hashlib.sha256(original).hexdigest(),v['sha256'])
    page_size=int.from_bytes(original[16:18],'big') or 65536
    self.assertEqual(page_size,4096)
    damaged=bytearray(original);damaged[4*page_size]=0
    path=work/f"{v['encoding']}-{v['state']}.db";path.write_bytes(damaged)
    db=C.c_void_p()
    self.assertEqual(d.sqlite3_open_v2(str(path).encode(),C.byref(db),m.SQLITE_OPEN_READONLY,None),m.OK)
    try:
     rows,work_counts=m.query(d,db,cap['sql']['in-composite-scan'],cap['parameters']['in-composite-scan'])
     self.assertEqual(rows,v['cases']['in-composite-scan']['rows'])
     self.assertGreater(work_counts['fullscanSteps'],0)
     sql=cap['sql']['in-composite'];st=C.c_void_p()
     self.assertEqual(d.sqlite3_prepare_v2(db,sql.encode(),-1,C.byref(st),None),m.OK)
     try:
      m.bind(d,st,cap['parameters']['in-composite'])
      self.assertEqual(d.sqlite3_step(st),11,'selected physical index root must fail')
     finally:self.assertEqual(d.sqlite3_finalize(st),11,'finalize propagates step error')
     # Native error does not poison the connection or require the selected root for a scan.
     rows,_=m.query(d,db,cap['sql']['in-composite-scan'],cap['parameters']['in-composite-scan'])
     self.assertEqual(rows,v['cases']['in-composite-scan']['rows'])
    finally:
     self.assertEqual(d.sqlite3_close(db),m.OK)
     path.unlink()
if __name__=='__main__':unittest.main()
