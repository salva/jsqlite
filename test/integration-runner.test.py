import importlib.util, os, pathlib, sys, unittest, signal
spec=importlib.util.spec_from_file_location('runner','tools/test/integration.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Runner(unittest.TestCase):
 def test_rejects_invalid_jobs(self):
  import subprocess
  result=subprocess.run([sys.executable,'tools/test/integration.py','--jobs','0'],capture_output=True,text=True)
  self.assertEqual(result.returncode,2)
  self.assertIn('--jobs must be positive',result.stderr)
 def test_exits_and_watchdog(self):
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'integration-runner-tests';work.mkdir(exist_ok=True)
  for i,(source,expected) in enumerate([('pass','completed'),('raise SystemExit(7)','fail'),('import time; time.sleep(20)','timeout')]):
   result=runner.component([sys.executable,'-c',source],work/f'{i}.log',0.2,os.environ)
   self.assertEqual(result['classification'],expected)
   if expected=='fail':self.assertEqual(result['exit'],7)
   if expected=='timeout':self.assertLess(result['seconds'],4)
  result=runner.component([sys.executable,'-c',"import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print('ready',flush=True);time.sleep(20)"],work/'ignore-term.log',0.2,os.environ)
  self.assertEqual(result['classification'],'timeout')
  self.assertEqual(result['exit'],-signal.SIGKILL)
if __name__=='__main__':unittest.main()
