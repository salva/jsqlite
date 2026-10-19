import importlib.util, os, pathlib, sys, unittest, signal
spec=importlib.util.spec_from_file_location('runner','tools/test/integration.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Runner(unittest.TestCase):
 def test_rejects_invalid_jobs(self):
  import subprocess
  result=subprocess.run([sys.executable,'tools/test/integration.py','--jobs','0'],capture_output=True,text=True)
  self.assertEqual(result.returncode,2)
  self.assertIn('--jobs must be 1',result.stderr)
 def test_serial_batch_ceiling_and_defaults(self):
  import subprocess, json
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'batch-controls'
  work.mkdir(parents=True,exist_ok=True)
  files=[]
  for name,source in [('slow',"setTimeout(()=>{},5000);"),('unrun',"console.log('must-not-run');"),('next',"console.log('next-batch');")]:
   file=work/f'{name}.test.mjs';file.write_text(source);files.append(str(file))
  env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(work/'bounded'))
  proc=subprocess.run([sys.executable,'tools/test/integration.py','--batch-size','2','--batch-seconds','1',*files],env=env,capture_output=True,text=True,timeout=15)
  self.assertEqual(proc.returncode,1,proc.stdout+proc.stderr)
  report=json.loads((work/'bounded/integration-run/manifest.json').read_text())
  self.assertEqual(report['watchdog_seconds'],60)
  self.assertEqual(report['concurrency'],1)
  self.assertEqual(report['files'],files)
  self.assertEqual(report['not_run'],[files[1]])
  self.assertEqual([r['file'] for r in report['results']],[files[0],files[2]])
  self.assertEqual(report['results'][0]['timeout_scope'],'batch')
  self.assertEqual(report['results'][1]['classification'],'completed')
  self.assertEqual(report['batches'][0]['classification'],'timeout')
  self.assertEqual(report['batches'][1]['classification'],'completed')
  self.assertEqual(report['input_drift'],[])
  env['SAIVAGE_CARD_WORK_ROOT']=str(work/'defaults')
  proc=subprocess.run([sys.executable,'tools/test/integration.py',files[2]],env=env,capture_output=True,text=True,timeout=15)
  self.assertEqual(proc.returncode,0,proc.stdout+proc.stderr)
  report=json.loads((work/'defaults/integration-run/manifest.json').read_text())
  self.assertEqual((report['batch_size'],report['batch_seconds'],report['watchdog_seconds']),(80,600,60))
  self.assertEqual(report['not_run'],[])

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
 def test_node_resource_watchdogs_and_aggregate_exits(self):
  """Resource controls are not a reconstruction of the historical 42-file run."""
  import subprocess, json, hashlib
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'node-resource-controls'
  work.mkdir(parents=True,exist_ok=True)
  # Closed resources must terminate; open resources and CPU work must remain
  # failures under the same external watchdog, not credited as engine interrupt.
  controls={
   'closed': "import http from 'node:http';const s=http.createServer();s.listen(0,'127.0.0.1',()=>s.close(()=>console.log('closed')));",
   'http': "import http from 'node:http';http.createServer().listen(0,'127.0.0.1',()=>console.log('http-ready'));",
   'worker': "import {Worker} from 'node:worker_threads';const w=new Worker(\"setInterval(()=>{},1000)\",{eval:true});w.once('online',()=>console.log('worker-ready'));",
   'loop': "console.log('loop-ready');while(true){}",
  }
  for name,source in controls.items():
   result=runner.component(['node','--input-type=module','-e',source],work/f'{name}.log',1,os.environ)
   self.assertEqual(result['classification'],'completed' if name=='closed' else 'timeout')
   self.assertIn('closed' if name=='closed' else name+'-ready',(work/f'{name}.log').read_text())
   self.assertEqual(result['log_sha256'],hashlib.sha256((work/f'{name}.log').read_bytes()).hexdigest())
   self.assertLess(result['seconds'],5)
  # Invoke the actual CLI: an earlier real failure/timeout cannot be erased by
  # a final successful file. No fixture producers or native library required.
  files=[]
  for name,source in [('fail',"throw new Error('intentional-control');"),('timeout',controls['http']),('pass',"console.log('final-pass');")]:
   file=work/f'{name}.test.mjs';file.write_text(source);files.append(str(file))
  env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(work/'aggregate'))
  proc=subprocess.run([sys.executable,'tools/test/integration.py','--watchdog-seconds','1',*files],env=env,capture_output=True,text=True,timeout=15)
  self.assertEqual(proc.returncode,1,proc.stdout+proc.stderr)
  report=json.loads((work/'aggregate/integration-run/manifest.json').read_text())
  self.assertEqual(report['files'],files)
  self.assertEqual([r['classification'] for r in report['results']],['fail','timeout','completed'])
  self.assertEqual(report['results'][-1]['exit'],0)
  self.assertEqual(report['input_drift'],[])
  self.assertEqual(report['prerequisites'],[])
  for result in report['results']:
   self.assertEqual(result['log_sha256'],hashlib.sha256(pathlib.Path(result['log']).read_bytes()).hexdigest())

 def test_successful_component_cannot_hide_input_drift(self):
  """Exit zero is insufficient when an executed input changes after hashing."""
  import subprocess, json, hashlib, tempfile
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])
  with tempfile.TemporaryDirectory(prefix='runner-input-drift-',dir=work) as directory:
   root=pathlib.Path(directory)
   file=root/'mutates.test.mjs'
   file.write_text("import fs from 'node:fs';fs.appendFileSync(new URL(import.meta.url),'\\n// changed during execution\\n');console.log('completed-control');\n")
   before=hashlib.sha256(file.read_bytes()).hexdigest()
   env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(root/'evidence'))
   proc=subprocess.run([sys.executable,'tools/test/integration.py',str(file)],env=env,capture_output=True,text=True,timeout=30)
   self.assertEqual(proc.returncode,1,proc.stdout+proc.stderr)
   report=json.loads((root/'evidence/integration-run/manifest.json').read_text())
   self.assertEqual(report['files'],[str(file)])
   self.assertEqual(report['prerequisites'],[])
   self.assertEqual(report['input_drift'],[str(file)])
   self.assertEqual(report['inputs'][str(file)],before)
   self.assertNotEqual(before,hashlib.sha256(file.read_bytes()).hexdigest())
   self.assertEqual(len(report['results']),1)
   result=report['results'][0]
   self.assertEqual(result['classification'],'completed')
   self.assertEqual(result['exit'],0)
   log=pathlib.Path(result['log']).read_bytes()
   self.assertIn(b'completed-control',log)
   self.assertEqual(result['log_sha256'],hashlib.sha256(log).hexdigest())

 def test_fixture_plan_and_chinook_invocation(self):
  root=pathlib.Path('/purpose/run');library=root/'oracle.so'
  plan=runner.prerequisite_commands(['test/storage/skipscan-prefix-seek.test.mjs','test/conformance/skipscan-stat1-producer.test.mjs','test/conformance/where-operand-admission-public.test.mjs'],library,root)
  scripts=[pathlib.Path(c[1]).name for c in plan]
  self.assertEqual(scripts,['capture-where-operand-admission.py','capture-where-order-consumption.py','capture.py','capture-primitive-companions.py','capture-order-companions.py','capture-stat1-companions.py','capture-corruption-companions.py','capture-wr-layout.py'])
  for command in plan:
   output=pathlib.Path(command[command.index('--output-dir' if '--output-dir' in command else '--output')+1]);self.assertTrue(output.is_relative_to(root))
  self.assertEqual(runner.prerequisite_commands(['test/value/mem.test.mjs'],library,root),[])
  command=runner.test_command('test/conformance/run-audit-chinook-b1-b5-ts.mjs')
  self.assertNotIn('--test',command);self.assertEqual(command[-1],'examples/browser/chinook.sqlite')
  self.assertIn('--test',runner.test_command('test/value/mem.test.mjs'))
 def test_date_fixture_plan_matches_positional_invocation(self):
  root=pathlib.Path('/purpose/date-run');library=root/'oracle.so'
  files=list(runner.DATE_FIXTURES)
  plan=runner.prerequisite_commands(files,library,root)
  self.assertEqual(len(plan),5)  # identity guard plus four producers
  self.assertEqual(plan[0][-2:],[str(library),str(root/'date-native')])
  for file,producer in zip(files,plan[1:]):
   script,output=runner.DATE_FIXTURES[file]
   target=str(root/'date-native'/output)
   self.assertEqual(producer,['python3',script,str(library),target])
   self.assertEqual(runner.test_command(file,root),['node','--experimental-strip-types',file,target])
   with self.assertRaises(ValueError):runner.test_command(file)
   self.assertEqual(len(runner.prerequisite_commands([file],library,root)),2)
  # A misspelled/ordinary test must not silently acquire unrelated fixtures.
  self.assertEqual(runner.prerequisite_commands(['test/value/mem.test.mjs'],library,root),[])

 def test_date_identity_guard_rejects_wrong_source_before_outputs(self):
  import subprocess, tempfile
  with tempfile.TemporaryDirectory(prefix='date-pin-negative-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory)
   # Exercise the actual guard in a fresh Python process without needing a
   # second native SQLite build. The fixture producer must never be reached.
   (root/'ctypes.py').write_text("c_char_p=object()\nclass Source:\n def __call__(self):return b'wrong-source'\nclass CDLL:\n def __init__(self,path):self.sqlite3_sourceid=Source()\n")
   command=runner.prerequisite_commands(list(runner.DATE_FIXTURES),root/'wrong.so',root)[0]
   env=dict(os.environ,PYTHONPATH=str(root),PYTHONDONTWRITEBYTECODE='1')
   result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=10)
   self.assertNotEqual(result.returncode,0)
   self.assertIn('wrong-source',result.stderr)
   self.assertFalse((root/'date-native').exists())

 def test_compound_fixture_plan_and_guard(self):
  import subprocess, tempfile
  root=pathlib.Path('/purpose/compound');library=root/'oracle.so'
  files=list(runner.COMPOUND_FIXTURES)
  plan=runner.prerequisite_commands(files,library,root)
  self.assertEqual(len(plan),3)
  for file,command in zip(files,plan[1:]):
   script,output,variable=runner.COMPOUND_FIXTURES[file]
   self.assertEqual(command,['python3',script,str(pathlib.Path.cwd()),str(root/output),str(library)])
   self.assertEqual(len(runner.prerequisite_commands([file],library,root)),2)
   self.assertIn('--test',runner.test_command(file,root))
  with tempfile.TemporaryDirectory(prefix='compound-pin-negative-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory)
   (root/'ctypes.py').write_text("c_char_p=object()\nclass Source:\n def __call__(self):return b'wrong-compound-source'\nclass CDLL:\n def __init__(self,path):self.sqlite3_sourceid=Source()\n")
   command=runner.prerequisite_commands(files,root/'wrong.so',root)[0]
   result=subprocess.run(command,env=dict(os.environ,PYTHONPATH=str(root),PYTHONDONTWRITEBYTECODE='1'),capture_output=True,text=True,timeout=10)
   self.assertNotEqual(result.returncode,0)
   self.assertIn('wrong-compound-source',result.stderr)
   for _,output,_ in runner.COMPOUND_FIXTURES.values():self.assertFalse((root/output).exists())
   # Actual CLI must stop before consumers on a wrong identity, even with
   # plausible ambient roots; failure remains visible in its manifest.
   import json
   library=root/'wrong.so';library.write_bytes(b'test-only-not-a-library')
   env=dict(os.environ,PYTHONPATH=str(root),PYTHONDONTWRITEBYTECODE='1',SAIVAGE_CARD_WORK_ROOT=str(root/'cli'),MULTI_OUTPUT_FIXTURES=str(root),WIDE_COMPOUND_FIXTURES=str(root))
   result=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',str(library),*files],env=env,capture_output=True,text=True,timeout=15)
   self.assertEqual(result.returncode,1,result.stdout+result.stderr)
   report=json.loads((root/'cli/integration-run/manifest.json').read_text())
   self.assertEqual(report['not_run'],files)
   self.assertEqual(report['results'],[])
   self.assertEqual(len(report['prerequisites']),1)
   self.assertEqual(report['prerequisites'][0]['classification'],'fail')
   for _,output,variable in runner.COMPOUND_FIXTURES.values():
    self.assertEqual(report['fixture_environment'][variable],str(root/'cli'/output))
    self.assertFalse((root/'cli'/output).exists())

 def test_watchdog_contains_descendant_after_leader_exits(self):
  import subprocess, time
  work=pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'integration-runner-tests';work.mkdir(exist_ok=True)
  pidfile=work/'descendant.pid';pidfile.unlink(missing_ok=True)
  child="import os,signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);open(%r,'w').write(str(os.getpid()));time.sleep(20)" % str(pidfile)
  parent="import subprocess,sys,time;subprocess.Popen([sys.executable,'-c',%r]);time.sleep(20)" % child
  result=runner.component([sys.executable,'-c',parent],work/'descendant.log',0.5,os.environ)
  try:
   self.assertEqual(result['classification'],'timeout')
   self.assertLess(result['seconds'],5)
   pid=int(pidfile.read_text())
   def running():
    try:return pathlib.Path(f'/proc/{pid}/stat').read_text().split(') ',1)[1].split()[0]!='Z'
    except FileNotFoundError:return False
   deadline=time.monotonic()+0.5
   while running() and time.monotonic()<deadline:time.sleep(0.01)
   self.assertFalse(running(),'watchdog must kill same-session descendant even if leader exits on TERM')
  finally:
   if pidfile.exists():
    try:os.kill(int(pidfile.read_text()),signal.SIGKILL)
    except ProcessLookupError:pass
if __name__=='__main__':unittest.main()
