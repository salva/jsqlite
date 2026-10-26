import importlib.util, os, pathlib, sys, unittest, signal
spec=importlib.util.spec_from_file_location('runner','tools/test/integration.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Runner(unittest.TestCase):
 def generated_capture_drift(self, action):
  import subprocess,tempfile,json,hashlib,shutil
  library=os.environ.get('INTEGRATION_TEST_ORACLE')
  if not library:
   self.skipTest('INTEGRATION_TEST_ORACLE required for real capture integrity control')
  # Retain actual CLI manifests and shim for diagnosis of a failed control.
  root=pathlib.Path(tempfile.mkdtemp(prefix='generated-'+action+'-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']))
  binary=root/'bin';binary.mkdir()
  node=shutil.which('node')
  self.assertIsNotNone(node)
  shim=binary/'node'
  shim.write_text('#!'+sys.executable+'\n'+
   'import os,pathlib,sys\n'+
   'if sys.argv[1:]==["--version"]: os.execv('+repr(node)+',["node","--version"])\n'+
   'p=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/"joined-order-boundary-native.json"\n'+
   ('p.write_text("{}")\n' if action=='mutate' else 'p.unlink()\n')+
   'raise SystemExit(0)\n')
  shim.chmod(0o755)
  env=dict(os.environ,PATH=str(binary)+os.pathsep+os.environ['PATH'],SAIVAGE_CARD_WORK_ROOT=str(root/'run'),PYTHONDONTWRITEBYTECODE='1')
  file='test/conformance/joined-order-boundary.test.mjs'
  corpus=pathlib.Path('test/conformance/cases/joined-order-boundary-native.json')
  expected=hashlib.sha256(corpus.read_bytes()).hexdigest()
  result=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',library,file],env=env,capture_output=True,text=True,timeout=300)
  report=json.loads((root/'run/integration-run/manifest.json').read_text())
  self.assertEqual([r['exit'] for r in report['prerequisites']],[0,0])
  self.assertEqual(report['generated_inputs'],{'joined-order-boundary-native.json':expected})
  self.assertEqual([r['exit'] for r in report['results']],[0])
  self.assertEqual([r['classification'] for r in report['results']],['completed'])
  self.assertEqual(report['not_run'],[])
  self.assertEqual(hashlib.sha256(corpus.read_bytes()).hexdigest(),expected)
  capture=root/'run/joined-order-boundary-native.json'
  if action=='mutate':
   self.assertNotEqual(hashlib.sha256(capture.read_bytes()).hexdigest(),expected)
  else:
   self.assertFalse(capture.exists())
  self.assertEqual(result.returncode,1,str(root)+': '+result.stdout+result.stderr)
  self.assertIn(str(capture),report['input_drift'])

 def test_generated_capture_mutation_fails_actual_cli(self):
  self.generated_capture_drift('mutate')

 def test_generated_capture_deletion_fails_actual_cli(self):
  self.generated_capture_drift('delete')

 def test_beta6_generated_capture_mutation_fails_actual_cli(self):
  import subprocess,tempfile,json,shutil
  library=os.environ.get('INTEGRATION_TEST_ORACLE')
  if not library:self.skipTest('INTEGRATION_TEST_ORACLE required')
  node=shutil.which('node');self.assertIsNotNone(node)
  with tempfile.TemporaryDirectory(dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as tmp:
   root=pathlib.Path(tmp);binary=root/'bin';binary.mkdir()
   shim=binary/'node'
   shim.write_text('#!'+sys.executable+'\nimport os,pathlib,sys\n'
    +'if sys.argv[1:]==["--version"]: os.execv('+repr(node)+',["node","--version"])\n'
    +'for name in ("beta6-destination-native.json","metadata-index-native.json"):\n'
    +' p=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/name; p.write_text("{}")\n')
   shim.chmod(0o755)
   env=dict(os.environ,PATH=str(binary)+os.pathsep+os.environ['PATH'],SAIVAGE_CARD_WORK_ROOT=str(root/'run'))
   result=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',library,
    'test/conformance/beta6-aggregate-subquery-destination.test.mjs',
    'test/conformance/metadata-index-production.test.mjs'],env=env,capture_output=True,timeout=300)
   report=json.loads((root/'run/integration-run/manifest.json').read_text())
   self.assertEqual([r['exit'] for r in report['prerequisites']],[0]*4)
   self.assertEqual([r['exit'] for r in report['results']],[0,0])
   self.assertEqual(set(report['generated_inputs']),{'beta6-destination-native.json','metadata-index-native.json'})
   self.assertEqual(set(report['input_drift']),{str(root/'run'/name) for name in report['generated_inputs']})
   self.assertEqual(result.returncode,1)

 def test_beta6_native_prerequisites(self):
  import subprocess,tempfile,json
  library=os.environ.get('INTEGRATION_TEST_ORACLE')
  if not library:
   self.skipTest('INTEGRATION_TEST_ORACLE required for native controls')
  files=['test/conformance/beta6-aggregate-subquery-destination.test.mjs',
         'test/conformance/metadata-index-production.test.mjs']
  with tempfile.TemporaryDirectory(dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as tmp:
   root=pathlib.Path(tmp)
   commands=runner.prerequisite_commands(files,pathlib.Path(library),root)
   self.assertEqual(len(commands),4)
   for command in commands:
    subprocess.run(command,check=True,timeout=180)
   # Equality must reject real semantic drift, not merely accept any JSON.
   for capture,command in zip(('beta6-destination-native.json','metadata-index-native.json'),commands[1::2]):
    path=root/capture; value=json.loads(path.read_text());value['sourceId']='wrong-pin'
    path.write_text(json.dumps(value))
    result=subprocess.run(command,capture_output=True,timeout=180)
    self.assertNotEqual(result.returncode,0)
   # A wrong library cannot create producer output or reach a consumer.
   bad=root/'missing.so'; work=root/'wrong-pin-work'
   plan=runner.prerequisite_commands(files,bad,work)
   for command in plan[::2]:
    self.assertNotEqual(subprocess.run(command,capture_output=True,timeout=180).returncode,0)
   self.assertFalse(work.exists())

 def test_prefix_native_enrollment(self):
  import subprocess,tempfile,json,hashlib
  library=os.environ.get('INTEGRATION_TEST_ORACLE')
  if not library:self.skipTest('INTEGRATION_TEST_ORACLE required')
  files=['test/conformance/like-prefix-native-red.test.mjs',
         'test/conformance/like-prefix-branches.test.mjs']
  originals={str(p):hashlib.sha256(p.read_bytes()).hexdigest()
   for pattern in ('test/conformance/fixtures/like-prefix*.db','test/conformance/cases/like-prefix*-native.json')
   for p in pathlib.Path('.').glob(pattern)}
  with tempfile.TemporaryDirectory(dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as tmp:
   root=pathlib.Path(tmp)
   plan=runner.prerequisite_commands(files+files,pathlib.Path(library),root)
   self.assertEqual(len(plan),2)
   self.assertNotIn('--branches',plan[0]);self.assertIn('--branches',plan[1])
   for command in plan:
    subprocess.run(command,check=True,timeout=180)
    # Reuse must fail rather than accepting stale output.
    self.assertNotEqual(subprocess.run(command,capture_output=True,timeout=180).returncode,0)
   wrong=runner.prerequisite_commands(files,root/'missing.so',root/'bad')
   for command in wrong:
    self.assertNotEqual(subprocess.run(command,capture_output=True,timeout=180).returncode,0)
   self.assertFalse((root/'bad').exists())
   # Actual CLI must retain generated ownership and fail on post-prerequisite drift.
   import shutil
   binary=root/'bin';binary.mkdir();node=shutil.which('node');self.assertIsNotNone(node)
   shim=binary/'node'
   shim.write_text('#!'+sys.executable+'\nimport os,pathlib,sys\n'
    +'if sys.argv[1:]==["--version"]: os.execv('+repr(node)+',["node","--version"])\n'
    +'p=pathlib.Path(os.environ["SAIVAGE_CARD_WORK_ROOT"])/"prefix-native/test/conformance/cases/like-prefix-native.json"\n'
    +'p.write_text("{}")\n')
   shim.chmod(0o755)
   env=dict(os.environ,PATH=str(binary)+os.pathsep+os.environ['PATH'],SAIVAGE_CARD_WORK_ROOT=str(root/'drift'))
   drift=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',library,files[0]],
    env=env,capture_output=True,timeout=180)
   report=json.loads((root/'drift/integration-run/manifest.json').read_text())
   self.assertEqual(drift.returncode,1)
   self.assertEqual([r['exit'] for r in report['prerequisites']],[0])
   self.assertEqual([r['exit'] for r in report['results']],[0])
   self.assertEqual(len(report['input_drift']),1)
   self.assertTrue(report['input_drift'][0].endswith('/cases/like-prefix-native.json'))
   self.assertEqual(len([p for p in report['generated_inputs'] if p.endswith('.db')]),3)
   # Alter only the comparison input in a minimal disposable checkout.
   checkout=root/'checkout';checkout.mkdir()
   for name in ('reference/sqlite/manifest.json','tools/test/capture-prefix.py',
                'test/conformance/capture-like-prefix.py','test/conformance/capture-index-planner.py',*originals):
    target=checkout/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(name,target)
   receipt=checkout/'test/conformance/cases/like-prefix-native.json'
   value=json.loads(receipt.read_text());value['tsCredit']=True;receipt.write_text(json.dumps(value))
   rejected=subprocess.run([sys.executable,str(checkout/'tools/test/capture-prefix.py'),
    '--library',library,'--output',str(root/'mismatch')],cwd=checkout,capture_output=True,timeout=180)
   self.assertNotEqual(rejected.returncode,0)
   self.assertIn(b'prefix native corpus mismatch',rejected.stderr)
  self.assertEqual(originals,{name:hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() for name in originals})

 def test_enrolled_fixture_union(self):
  root=pathlib.Path('/purpose/enrolled');library=root/'oracle.so'
  files=runner.discover_files(pathlib.Path.cwd())
  import hashlib
  # Frozen newline-delimited ordered inventories: 9c84706 baseline and
  # 574085e Window union, plus the explicit 87eebff joined ORDER addition.
  additions={f'test/conformance/{name}.test.mjs' for name in (
   'window-concat-straccum','window-extrema-application','window-extrema-cleanup',
   'window-extrema-lifecycle','window-extrema-native')}
  digest=lambda paths:hashlib.sha256(('\n'.join(paths)+'\n').encode()).hexdigest()
  joined='test/conformance/joined-order-boundary.test.mjs'
  self.assertIn(joined,files)
  beta6={f'test/conformance/{name}.test.mjs' for name in (
   'beta6-aggregate-subquery-destination','metadata-index-production','right-control-target-visitor')}
  self.assertEqual(set(files)&beta6,beta6)
  delivery='test/conformance/select-delivery-phase.test.mjs'
  self.assertIn(delivery,files)
  prefix={f'test/conformance/like-prefix-{name}.test.mjs' for name in (
   'branches','native-red','primitive','red','string8')}
  self.assertEqual(set(files)&prefix,prefix)
  # Explicit beta7 membership preserves every frozen historical projection.
  beta7={f'test/conformance/{name}.test.mjs' for name in (
   'column-default','column-default-affinity','column-default-branches',
   'column-default-cast','column-default-empty','column-default-float',
   'column-default-quoted','column-default-raw-token',
   'like-prefix-composite','like-prefix-composite-red','select-case-owner',
   'select-cast-affinity','select-cast-empty','select-cast-raw-token',
   'select-derived-physical-binding','select-mixed-json-binding',
   'select-review32-boundaries','select-window-payload-binding',
   'select-zero-source-binding')}
  self.assertEqual(set(files)&beta7,beta7)
  self.assertEqual(len(files),556)
  prefix_era=[file for file in files if file not in beta7]
  self.assertEqual(len(prefix_era),537)
  pre_prefix=[file for file in prefix_era if file not in prefix]
  previous=[file for file in pre_prefix if file not in beta6 and file!=delivery]
  self.assertEqual(len(previous),528)
  original=[file for file in previous if file!=joined]
  self.assertEqual(len(pre_prefix),532)
  self.assertEqual(len(files),len(set(files)))
  self.assertEqual(files,sorted(files))
  self.assertEqual(set(files)&additions,additions)
  baseline=[file for file in original if file not in additions]
  self.assertEqual(len(baseline),522)
  self.assertEqual(digest(baseline),'de85e908c9cfc6946db7ba2e764aa7199e55746112a6984ee4b425b7c522aa8a')
  self.assertEqual(len(original),527)
  self.assertEqual(digest(original),'67590671a15752ca9a41091bb09a4c19936b93219ce7806d8b3c3163ab9200e2')
  selected=runner.selected_fixture_keys(files)
  self.assertEqual(set(selected),set(runner.SELECT_FIXTURES))
  plan=runner.prerequisite_commands(files,library,root)
  for key in selected:
   self.assertEqual(plan.count(runner.select_fixture_command(key,library,root)),1,key)
  expected=sorted({str(p) for pattern in ('test/conformance/*.test.mjs','test/conformance/run-*-ts.mjs','test/storage/*.test.mjs','test/parser/*.test.mjs') for p in pathlib.Path('.').glob(pattern)})
  self.assertEqual(files,expected)

 def test_inventory_rejects_equal_cardinality_substitution(self):
  from unittest.mock import patch
  files=runner.discover_files(pathlib.Path.cwd())
  for removed in ('column-default','like-prefix-composite','select-review32-boundaries',
                  'aggregate-context-opcodes'):
   original=f'test/conformance/{removed}.test.mjs'
   self.assertIn(original,files)
   substituted=sorted([file for file in files if file!=original]+
                      ['test/conformance/unapproved-substitution.test.mjs'])
   with self.subTest(removed=removed), patch.object(runner,'discover_files',return_value=substituted):
    with self.assertRaises(AssertionError):
     self.test_enrolled_fixture_union()

 def test_joined_order_recapture_and_compare(self):
  import subprocess,tempfile,json
  file='test/conformance/joined-order-boundary.test.mjs'
  with tempfile.TemporaryDirectory(prefix='joined-order-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory)
   plan=runner.prerequisite_commands([file,file],root/'oracle.so',root)
   self.assertEqual(len(plan),2)
   target=root/'joined-order-boundary-native.json'
   self.assertEqual(plan[0],['python3','test/conformance/capture-joined-order-boundary.py','--library',str(root/'oracle.so'),'--output',str(target)])
   corpus=pathlib.Path(plan[1][-1])
   target.write_bytes(corpus.read_bytes())
   self.assertEqual(subprocess.run(plan[1],capture_output=True,timeout=10).returncode,0)
   target.write_text('{}')
   rejected=subprocess.run(plan[1],capture_output=True,text=True,timeout=10)
   self.assertNotEqual(rejected.returncode,0)
   self.assertIn('native corpus mismatch',rejected.stderr)
   wrong=root/'wrong.so';wrong.write_bytes(b'not a library')
   env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(root/'failed-cli'),PYTHONDONTWRITEBYTECODE='1')
   failed=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',str(wrong),file],env=env,capture_output=True,text=True,timeout=30)
   self.assertEqual(failed.returncode,1,failed.stdout+failed.stderr)
   report=json.loads((root/'failed-cli/integration-run/manifest.json').read_text())
   self.assertEqual(report['not_run'],[file])
   self.assertEqual(report['results'],[])
   self.assertEqual(len(report['prerequisites']),1)
   self.assertNotEqual(report['prerequisites'][0]['exit'],0)
   self.assertFalse((root/'failed-cli/joined-order-boundary-native.json').exists())
   library=os.environ.get('INTEGRATION_TEST_ORACLE')
   if library:
    command=runner.prerequisite_commands([file],pathlib.Path(library),root)[0]
    subprocess.run(command,check=True,timeout=180)
    subprocess.run(plan[1],check=True,timeout=10)
    # Exercise the actual reporting boundary, not only the command builder.
    env=dict(os.environ,SAIVAGE_CARD_WORK_ROOT=str(root/'cli'),PYTHONDONTWRITEBYTECODE='1')
    result=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',library,file],env=env,capture_output=True,text=True,timeout=300)
    self.assertEqual(result.returncode,0,result.stdout+result.stderr)
    report=json.loads((root/'cli/integration-run/manifest.json').read_text())
    import hashlib
    captured=root/'cli/joined-order-boundary-native.json'
    expected=hashlib.sha256(corpus.read_bytes()).hexdigest()
    self.assertEqual(hashlib.sha256(captured.read_bytes()).hexdigest(),expected)
    self.assertEqual(report['generated_inputs'],{captured.name:expected})
    self.assertEqual([r['exit'] for r in report['prerequisites']],[0,0])
    self.assertEqual(report['not_run'],[])
    self.assertEqual(report['input_drift'],[])
    self.assertEqual([r['exit'] for r in report['results']],[0])

 def test_enrollment_wrong_identity_stops_before_outputs(self):
  import subprocess,tempfile,json
  files=['test/conformance/correlated-in-corruption.test.mjs','test/conformance/selected-select-in-persistent-errors.test.mjs']
  with tempfile.TemporaryDirectory(prefix='enrollment-negative-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory);library=root/'wrong.so';library.write_bytes(b'control')
   (root/'ctypes.py').write_text("c_char_p=object()\nclass Source:\n def __call__(self):return b'wrong-source'\nclass CDLL:\n def __init__(self,path):self.sqlite3_sourceid=Source();self.sqlite3_libversion=Source()\n")
   env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',PYTHONPATH=str(root),SAIVAGE_CARD_WORK_ROOT=str(root/'run'),CORRELATED_IN_CORRUPTION_DIR='ambient',SELECT_IN_REUSE_MATRIX_DIR='ambient',SELECT_IN_NATIVE_DIR='unselected-ambient')
   proc=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',str(library),*files],env=env,capture_output=True,text=True,timeout=15)
   self.assertEqual(proc.returncode,1,proc.stdout+proc.stderr)
   report=json.loads((root/'run/integration-run/manifest.json').read_text())
   self.assertEqual(report['not_run'],files);self.assertEqual(report['results'],[])
   self.assertEqual(len(report['prerequisites']),1)
   self.assertIn('wrong-source',pathlib.Path(report['prerequisites'][0]['log']).read_text())
   for key in runner.selected_fixture_keys(files):
    self.assertEqual(report['fixture_environment'][key],str(root/'run'/runner.SELECT_FIXTURES[key][0]))
    self.assertFalse((root/'run'/runner.SELECT_FIXTURES[key][0]).exists())
   self.assertNotIn('SELECT_IN_NATIVE_DIR',report['fixture_environment'])

 def test_enrolled_original_capture_argv(self):
  root=pathlib.Path('/purpose/capture');lib=root/'oracle.so'
  for key,script,flags in [
   ('DERIVED_SELECTED_IN_DIR','capture-derived-selected-in.py',['--nested']),
   ('GROUPED_SELECTED_IN_DIR','capture-derived-selected-in.py',['--grouped']),
   ('RETAINED_LIMIT_SELECTED_IN_DIR','capture-derived-selected-in.py',['--retained-limit']),
   ('SELECT_IN_R1_MATRIX_DIR','capture-selected-in-r1-matrix.py',[]),
   ('SELECT_IN_REUSE_DIR','capture-select-in-reuse.py',[]),
   ('SELECT_IN_VECTOR_DIR','capture-selected-vector-in.py',[]),
   ('SELECT_IN_CORRELATED_DIR','capture-selected-correlated-in.py',[])]:
   command=runner.select_fixture_command(key,lib,root)
   self.assertEqual(command[:5],['python3','test/conformance/'+script,'--library',str(lib),'--output'])
   self.assertEqual(command[6:],flags)
  for key,source,script in [
   ('SELECT_IN_CORRUPTION_DIR','SELECT_IN_NATIVE_DIR','capture-select-in-corruption.py'),
   ('SELECT_IN_PERSISTENT_CORRUPTION_DIR','SELECT_IN_REUSE_MATRIX_DIR','capture-select-in-persistent-corruption.py')]:
   self.assertEqual(runner.select_fixture_command(key,lib,root),['python3','test/conformance/'+script,str(lib),str(root/runner.SELECT_FIXTURES[source][0]),str(root/runner.SELECT_FIXTURES[key][0])])
  self.assertEqual(runner.selected_fixture_keys(['test/conformance/not-selected-in.test.mjs']),[])

 def test_real_capture_to_consumer_and_hash_inventory(self):
  import subprocess,tempfile,json,hashlib
  library=os.environ.get('INTEGRATION_TEST_ORACLE')
  if not library:self.skipTest('set INTEGRATION_TEST_ORACLE to the pinned dev library')
  file='test/conformance/correlated-in-corruption.test.mjs'
  with tempfile.TemporaryDirectory(prefix='enrollment-positive-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory)
   env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',SAIVAGE_CARD_WORK_ROOT=str(root),CORRELATED_IN_CORRUPTION_DIR='ambient-invalid',SELECT_IN_NATIVE_DIR='unselected-invalid')
   proc=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',library,file,file],env=env,capture_output=True,text=True,timeout=120)
   self.assertEqual(proc.returncode,0,proc.stdout+proc.stderr)
   report=json.loads((root/'integration-run/manifest.json').read_text())
   self.assertEqual(report['files'],[file,file]);self.assertEqual(report['not_run'],[])
   self.assertEqual(len(report['prerequisites']),2) # one pin guard, one real capture
   self.assertEqual([r['classification'] for r in report['results']],['completed','completed'])
   self.assertEqual(report['fixture_environment']['CORRELATED_IN_CORRUPTION_DIR'],str(root/'correlated-corruption'))
   self.assertNotIn('SELECT_IN_NATIVE_DIR',report['fixture_environment'])
   expected={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'correlated-corruption').rglob('*') if p.is_file()}
   self.assertEqual(report['generated_inputs'],expected)
   self.assertEqual(len(expected),8) # three originals, three damaged images, two receipts
   self.assertEqual(report['input_drift'],[])

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
  self.assertEqual(report['watchdog_seconds'],100)
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
  self.assertEqual((report['batch_size'],report['batch_seconds'],report['watchdog_seconds']),(80,600,100))
  self.assertEqual(report['not_run'],[])

 def test_policy_commands_and_nullable_partition_inventory(self):
  import ast
  root=pathlib.Path.cwd()
  files=runner.discover_files(root)
  expected={}
  for join in ['RIGHT','FULL']:
   for encoding,suffix in [('UTF-8',''),('UTF-16le','-utf16le'),('UTF-16be','-utf16be')]:
    file=f'test/conformance/or-wr-{join.lower()}{suffix}.test.mjs'
    expected[file]=(join,encoding)
    self.assertEqual(files.count(file),1)
    # Every partition must invoke the same unchanged assertion/fixture owner.
    text=(root/file).read_text()
    self.assertIn("from './or-wr-nullable-cases.mjs'",text)
    self.assertIn(f"registerNullableComposition('{join}','{encoding}')",text)
    self.assertEqual(runner.test_command(file),['node','--experimental-strip-types','--test','--test-timeout=100000',file])
    self.assertIn('--test-timeout=7000',runner.test_command(file,file_seconds=7))
  self.assertEqual([f for f in files if f in expected],sorted(expected))
  self.assertNotIn('test/conformance/or-wr-nullable-cases.mjs',files)
  self.assertIn('{timeout:100000}',(root/'test/conformance/or-wr-nullable-cases.mjs').read_text())
  # Inspect the actual wrapper's argument list, not an unrelated policy constant.
  tree=ast.parse((root/'tools/test/selected-in-gate.py').read_text())
  commands=[n for n in ast.walk(tree) if isinstance(n,ast.List) and any(isinstance(e,ast.Constant) and e.value=='tools/test/integration.py' for e in n.elts)]
  self.assertEqual(len(commands),1)
  values=[e.value for e in commands[0].elts if isinstance(e,ast.Constant)]
  for flag,value in [('--jobs','1'),('--batch-size','80'),('--batch-seconds','600'),('--watchdog-seconds','100')]:
   self.assertEqual(values[values.index(flag)+1],value)

 def test_batch_passes_configured_allowance_to_node_and_watchdog(self):
  from unittest.mock import patch
  report={'results':[]}
  work=pathlib.Path('/purpose/policy-controls')
  calls=[]
  def component(command,log,seconds,env):
   calls.append((command,seconds))
   return {'classification':'completed','exit':0}
  # Frozen clock makes the independent batch budget exact, without a100s sleep.
  with patch.object(runner,'component',side_effect=component),patch.object(runner.time,'monotonic',return_value=0):
   runner.run_batches(['a.test.mjs','b.test.mjs'],work,work,{},100,1,600,report,lambda:None)
  self.assertEqual(len(report['batches']),2)
  self.assertEqual(report['not_run'],[])
  for command,seconds in calls:
   self.assertIn('--test-timeout=100000',command)
   self.assertEqual(seconds,100)

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

 def test_covered_deferred_plan_and_failed_producer(self):
  import subprocess, tempfile, json
  file='test/conformance/covered-deferred.test.mjs'
  root=pathlib.Path('/purpose/covered');library=root/'oracle.so'
  self.assertEqual(runner.prerequisite_commands([file],library,root),[
   ['python3','test/conformance/capture-covered-deferred.py','--library',str(library),'--output',str(root/'covered-deferred-native')]])
  # Similar names and ordinary consumers must not acquire this producer.
  for other in ['test/conformance/covered-deferred-other.test.mjs','test/value/mem.test.mjs']:
   self.assertEqual(runner.prerequisite_commands([other],library,root),[])
  with tempfile.TemporaryDirectory(prefix='covered-negative-',dir=os.environ['SAIVAGE_CARD_WORK_ROOT']) as directory:
   root=pathlib.Path(directory);library=root/'invalid.so';library.write_bytes(b'not a native library')
   env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',SAIVAGE_CARD_WORK_ROOT=str(root/'run'),COVERED_DEFERRED_DIR=str(root/'ambient'))
   result=subprocess.run([sys.executable,'tools/test/integration.py','--oracle-library',str(library),file],env=env,capture_output=True,text=True,timeout=15)
   self.assertEqual(result.returncode,1,result.stdout+result.stderr)
   report=json.loads((root/'run/integration-run/manifest.json').read_text())
   self.assertEqual(report['fixture_environment']['COVERED_DEFERRED_DIR'],str(root/'run/covered-deferred-native'))
   self.assertEqual(report['not_run'],[file]);self.assertEqual(report['results'],[])
   self.assertEqual(len(report['prerequisites']),1)
   self.assertEqual(report['prerequisites'][0]['classification'],'fail')
   self.assertFalse((root/'run/covered-deferred-native').exists())

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
