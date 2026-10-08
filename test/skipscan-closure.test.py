import importlib.util, json, os, pathlib, unittest, hashlib
spec=importlib.util.spec_from_file_location('closure','tools/test/skipscan-closure.py');closure=importlib.util.module_from_spec(spec);spec.loader.exec_module(closure)
class Closure(unittest.TestCase):
 def test_default_and_explicit_roots(self):
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'closure-unit';work.mkdir(parents=True,exist_ok=True)
  self.assertEqual(closure.fixture_root(None,work),work/'skipscan-native')
  self.assertEqual(closure.fixture_root(str(work/'explicit'),work),work/'explicit')
 def test_missing_identity_and_hash_are_errors(self):
  root=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'closure-unit';root.mkdir(parents=True,exist_ok=True)
  pin={'sqliteSourceId':'pinned'}
  with self.assertRaises(FileNotFoundError):closure.verify_base(root/'absent',pin)
  (root/'fixtures').mkdir(exist_ok=True);raw=b'fixture';(root/'fixtures/x.db').write_bytes(raw)
  capture={'source':pin,'variants':[{'fixture':{'path':'x.db','sha256':hashlib.sha256(raw).hexdigest()},'malformedSelectedRoot':{'fixture':'x.db','sha256':hashlib.sha256(raw).hexdigest()}}]}
  (root/'native.json').write_text(json.dumps(capture));closure.verify_base(root,pin)
  (root/'fixtures/x.db').unlink()
  with self.assertRaises(FileNotFoundError):closure.verify_base(root,pin)
  (root/'fixtures/x.db').write_bytes(raw)
  capture['source']={'sqliteSourceId':'wrong'};(root/'native.json').write_text(json.dumps(capture))
  with self.assertRaisesRegex(ValueError,'source'):closure.verify_base(root,pin)
  capture['source']=pin;(root/'native.json').write_text(json.dumps(capture));(root/'fixtures/x.db').write_bytes(b'changed')
  with self.assertRaisesRegex(ValueError,'hash'):closure.verify_base(root,pin)
if __name__=='__main__':unittest.main()
