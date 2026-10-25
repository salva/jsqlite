#!/usr/bin/env python3
"""Development-only bounded integration runner. A watchdog is failure, not credit."""
import argparse, hashlib, json, os, pathlib, signal, subprocess, time


# Development-only positional fixture ownership, shared by planning and invocation.
DATE_FIXTURES = {
    'test/conformance/run-date-time-admission-ts.mjs': ('docs/research/card-q-a-b-date-admission.py', 'admission'),
    'test/conformance/run-date-time-generated-matrix-ts.mjs': ('docs/research/card-q-a-b-generated-matrix.py', 'generated-matrix'),
    'test/conformance/run-date-time-generated-ts.mjs': ('docs/research/card-q-a-a-generated-probe.py', 'generated.db'),
    'test/conformance/run-date-time-registration-ts.mjs': ('docs/research/card-q-a-b-registration-fixtures.py', 'registration'),
}


COMPOUND_FIXTURES = {
    'test/conformance/compound-multi-output.test.mjs': ('docs/research/multi-output-compound-capture.py', 'multi-output-native', 'MULTI_OUTPUT_FIXTURES'),
    'test/conformance/compound-wide-native.test.mjs': ('docs/research/compound-wide-capture.py', 'wide-compound-native', 'WIDE_COMPOUND_FIXTURES'),
}


# Exact consumer ownership; dependencies precede their corruption captures.
# Each tuple is (output directory, capture script, argv style, flags, consumers).
SELECT_FIXTURES = {
 'CORRELATED_IN_CORRUPTION_DIR': ('correlated-corruption','capture-correlated-in-corruption.py','options',(),('correlated-in-corruption',)),
 'CORRELATED_IN_WORK_DIR': ('correlated-work','capture-correlated-in-work.py','options',(),('correlated-in-work','correlated-in-work-utf16le','correlated-in-work-utf16be')),
 'COMMON_CHECKPOINT_OUTPUT': ('derived-aggregate','derived-order-limit-aggregate-native.py','environment',(),('derived-order-limit-aggregate','derived-aggregate-resources')),
 'RETAINED_GROUP_EXTENDED': ('retained-group','retained-group-native.py','environment',(),('retained-group-native-public','retained-group-resources')),
 'DERIVED_SELECTED_IN_DIR': ('derived-selected-in','capture-derived-selected-in.py','options',('--nested',),('derived-selected-in',)),
 'GROUPED_SELECTED_IN_DIR': ('grouped-selected-in','capture-derived-selected-in.py','options',('--grouped',),('grouped-selected-in',)),
 'RETAINED_LIMIT_SELECTED_IN_DIR': ('retained-limit-selected-in','capture-derived-selected-in.py','options',('--retained-limit',),('retained-limit-selected-in',)),
 'SELECT_IN_R1_MATRIX_DIR': ('r1-matrix','capture-selected-in-r1-matrix.py','options',(),('selected-in-r1-matrix','selected-correlated-in-lifecycle')),
 'SELECT_IN_NATIVE_DIR': ('select-in-native','capture-selected-select-in.py','positional',(),('selected-select-in-affinity','selected-select-in-errors','selected-select-in-lifecycle','selected-select-in-null-prefix','selected-select-in-red','where-in-linked-producer')),
 'SELECT_IN_EARLYOUT_DIR': ('select-in-earlyout','capture-select-in-earlyout.py','positional',(),('selected-select-in-earlyout',)),
 'SELECT_IN_VECTOR_DIR': ('vector-red','capture-selected-vector-in.py','options',(),('selected-vector-in',)),
 'SELECT_IN_REUSE_DIR': ('select-in-reuse','capture-select-in-reuse.py','options',(),('selected-select-in-reuse',)),
 'SELECT_IN_REUSE_MATRIX_DIR': ('select-in-reuse-matrix','capture-select-in-reuse-matrix.py','options',(),('selected-select-in-reuse-matrix','selected-select-in-persistent-errors')),
 'SELECT_IN_CORRELATED_DIR': ('correlated-red','capture-selected-correlated-in.py','options',(),('selected-correlated-in',)),
 'SELECT_IN_CORRUPTION_DIR': ('select-in-corruption','capture-select-in-corruption.py','SELECT_IN_NATIVE_DIR',(),('selected-select-in-errors',)),
 'SELECT_IN_PERSISTENT_CORRUPTION_DIR': ('select-in-persistent-corruption','capture-select-in-persistent-corruption.py','SELECT_IN_REUSE_MATRIX_DIR',(),('selected-select-in-persistent-errors',)),
}


def selected_fixture_keys(files):
    names = {pathlib.Path(f).name for f in files}
    return [key for key, (_, _, _, _, consumers) in SELECT_FIXTURES.items()
            if any(name+'.test.mjs' in names for name in consumers)]


def select_fixture_command(key, library, work_root):
    output, script, style, flags, _ = SELECT_FIXTURES[key]
    script = 'test/conformance/'+script
    target = str(work_root/output)
    if style == 'environment':
        # These original producers both use COMMON_CHECKPOINT_OUTPUT. Give each
        # its own subprocess environment, never mutate the consumer environment.
        return ['python3', '-c',
                "import os,runpy,sys; os.environ['COMMON_CHECKPOINT_OUTPUT']=sys.argv.pop(1); script=sys.argv.pop(1); sys.argv[0]=script; runpy.run_path(script,run_name='__main__')",
                target, script, str(library)]
    if style == 'options':
        return ['python3', script, '--library', str(library), '--output', target, *flags]
    if style == 'positional':
        return ['python3', script, str(library), target]
    return ['python3', script, str(library), str(work_root/SELECT_FIXTURES[style][0]), target]


def prerequisite_commands(files, library, work_root):
    """Fixture producers run in dependency order, outside the source tree."""
    commands = []
    if 'test/conformance/joined-order-boundary.test.mjs' in files:
        # Recapture without overwriting the committed consumer corpus.
        target = str(work_root/'joined-order-boundary-native.json')
        commands.extend([
            ['python3', 'test/conformance/capture-joined-order-boundary.py',
             '--library', str(library), '--output', target],
            ['python3', '-c',
             "import json,pathlib,sys; "
             "actual=json.loads(pathlib.Path(sys.argv[1]).read_text()); "
             "expected=json.loads(pathlib.Path(sys.argv[2]).read_text()); "
             "assert actual==expected,'joined ORDER native corpus mismatch'",
             target, 'test/conformance/cases/joined-order-boundary-native.json'],
        ])
    selected_keys = selected_fixture_keys(files)
    if selected_keys:
        # Several original producers mkdir before loading SQLite. Authenticate
        # both pin fields here before any of those producers can create output.
        commands.append(['python3', '-c',
            "import ctypes,json,pathlib,sys; lib=ctypes.CDLL(sys.argv[1]); "
            "lib.sqlite3_sourceid.restype=ctypes.c_char_p; lib.sqlite3_libversion.restype=ctypes.c_char_p; "
            "pin=json.loads(pathlib.Path('reference/sqlite/manifest.json').read_text()); "
            "assert lib.sqlite3_sourceid().decode()==pin['sqliteSourceId'],lib.sqlite3_sourceid().decode(); "
            "assert lib.sqlite3_libversion().decode()==pin['version']; print(pin['sqliteSourceId'])", str(library)])
        commands.extend(select_fixture_command(key, library, work_root) for key in selected_keys)
    if 'test/conformance/covered-deferred.test.mjs' in files:
        commands.append(['python3', 'test/conformance/capture-covered-deferred.py',
                         '--library', str(library), '--output', str(work_root/'covered-deferred-native')])
    compounds = [f for f in COMPOUND_FIXTURES if f in files]
    if compounds:
        # Reject wrong identity before either producer creates output directories.
        commands.append(['python3', '-c',
            "import ctypes,json,pathlib,sys; "
            "lib=ctypes.CDLL(sys.argv[1]); lib.sqlite3_sourceid.restype=ctypes.c_char_p; "
            "actual=lib.sqlite3_sourceid().decode(); "
            "expected=json.loads(pathlib.Path('reference/sqlite/manifest.json').read_text())['sqliteSourceId']; "
            "assert actual==expected,(actual,expected); print(actual)", str(library)])
        for file in compounds:
            script, output, _ = COMPOUND_FIXTURES[file]
            commands.append(['python3', script, str(pathlib.Path.cwd()), str(work_root/output), str(library)])
    selected = [f for f in DATE_FIXTURES if f in files]
    if selected:
        # Older diagnostic producers print identity but do not assert it.
        # Reject a wrong native library before creating any fixture.
        commands.append(['python3', '-c',
            "import ctypes,json,pathlib,sys; "
            "lib=ctypes.CDLL(sys.argv[1]); lib.sqlite3_sourceid.restype=ctypes.c_char_p; "
            "actual=lib.sqlite3_sourceid().decode(); "
            "expected=json.loads(pathlib.Path('reference/sqlite/manifest.json').read_text())['sqliteSourceId']; "
            "assert actual==expected,(actual,expected); "
            "pathlib.Path(sys.argv[2]).mkdir(parents=True,exist_ok=True); print(actual)",
            str(library), str(work_root/'date-native')])
        for file in selected:
            script, output = DATE_FIXTURES[file]
            commands.append(['python3', script, str(library), str(work_root/'date-native'/output)])
    names = {pathlib.Path(f).name for f in files}
    if names & {'where-operand-admission-public.test.mjs', 'where-order-consumption-public.test.mjs', 'skipscan-seek-consumer.test.mjs'}:
        for script, output in [('operand-admission', 'r1-native'), ('order-consumption', 'r2-native')]:
            commands.append(['python3', f'test/conformance/capture-where-{script}.py', '--library', str(library), '--output-dir', str(work_root/output)])
    if any(name.startswith('skipscan-') and name.endswith('.test.mjs') for name in names):
        root = work_root/'skipscan-native'
        base = 'docs/research/card-s-g/'
        commands.extend([
            ['python3', base+'capture.py', '--library', str(library), '--output-dir', str(root), '--fixture-dir', 'fixtures'],
            ['python3', base+'capture-primitive-companions.py', '--library', str(library), '--output-dir', str(root/'primitive-companions')],
            ['python3', base+'capture-order-companions.py', '--library', str(library), '--output', str(root/'order-native.json'), '--primitive-root', str(root/'primitive-companions')],
            ['python3', base+'capture-stat1-companions.py', '--library', str(library), '--output-dir', str(root/'stat1-companions'), '--primitive-root', str(root/'primitive-companions')],
            ['python3', base+'capture-corruption-companions.py', '--library', str(library), '--output-dir', str(root/'corruption-companions'), '--primitive-root', str(root/'primitive-companions')],
            ['python3', base+'capture-wr-layout.py', '--library', str(library), '--output-dir', str(root)],
        ])
    return commands


def discover_files(root):
    return sorted({str(f.relative_to(root)) for pattern in (
        'test/conformance/*.test.mjs', 'test/conformance/run-*-ts.mjs',
        'test/storage/*.test.mjs', 'test/parser/*.test.mjs') for f in root.glob(pattern)})


def test_command(file, work_root=None, file_seconds=100):
    if file in DATE_FIXTURES:
        if work_root is None:
            raise ValueError('date fixture command requires a planned work root')
        return ['node', '--experimental-strip-types', file,
                str(work_root/'date-native'/DATE_FIXTURES[file][1])]
    # This script requires a positional fixture, unlike node:test suites.
    if file == 'test/conformance/run-audit-chinook-b1-b5-ts.mjs':
        return ['node', '--experimental-strip-types', file, 'examples/browser/chinook.sqlite']
    return ['node', '--experimental-strip-types', '--test',
            f'--test-timeout={file_seconds * 1000}', file]


def component(command, log, seconds, env):
    start = time.monotonic()
    with log.open('wb') as out:
        proc = subprocess.Popen(command, stdout=out, stderr=subprocess.STDOUT,
                                env=env, start_new_session=True)
        timeout = False
        try:
            code = proc.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            timeout = True
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                code = proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                code = proc.wait()
            finally:
                # The leader may exit on TERM while its workers ignore it.
                # Waiting for the leader alone does not contain that session.
                # Always finish timeout containment of the original process group;
                # keep the leader's actual exit and timeout classification.
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
    return dict(command=command, exit=code, classification='timeout' if timeout else
                'completed' if code == 0 else 'fail', seconds=round(time.monotonic()-start, 3),
                log=str(log), log_sha256=hashlib.sha256(log.read_bytes()).hexdigest())


def run_batches(files, work, work_root, env, file_seconds, batch_size,
                batch_seconds, report, save):
    """Serial ordered batches; each has an independent safety ceiling.

    A ceiling stops that batch, records its unrun tail, and permits the next
    batch. Fixtures and frozen input identity belong to the whole invocation.
    """
    report['batches'] = []
    report['not_run'] = []
    for start in range(0, len(files), batch_size):
        selected = files[start:start + batch_size]
        began = time.monotonic()
        batch = dict(files=selected, results=[], not_run=[], classification='completed')
        report['batches'].append(batch)
        for offset, file in enumerate(selected):
            remaining = batch_seconds - (time.monotonic() - began)
            if remaining <= 0:
                batch['classification'] = 'timeout'
                batch['not_run'] = selected[offset:]
                report['not_run'].extend(batch['not_run'])
                break
            result = component(test_command(file, work_root, file_seconds),
                               work/f'{start + offset:03d}.log',
                               min(file_seconds, remaining), env)
            result['file'] = file
            result['timeout_scope'] = ('batch' if remaining < file_seconds else 'file') if result['classification'] == 'timeout' else None
            batch['results'].append(result)
            report['results'].append(result)
            if result['classification'] != 'completed':
                batch['classification'] = 'fail'
            if result['timeout_scope'] == 'batch':
                batch['classification'] = 'timeout'
                batch['not_run'] = selected[offset + 1:]
                report['not_run'].extend(batch['not_run'])
                save()
                print(result['classification'], result['exit'], file, flush=True)
                break
            save()
            print(result['classification'], result['exit'], file, flush=True)
        batch['seconds'] = round(time.monotonic() - began, 3)
        save()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('files', nargs='*')
    p.add_argument('--jobs', type=int, default=1, help='must be 1: batches execute serially')
    p.add_argument('--batch-size', type=int, default=80, help='maximum files per serial batch (default: 80)')
    p.add_argument('--batch-seconds', type=int, default=600, help='independent per-batch safety ceiling (default: 600)')
    p.add_argument('--watchdog-seconds', type=int, default=100, help='positive per-file watchdog (default: 100)')
    p.add_argument('--oracle-library', type=pathlib.Path, help='existing dev oracle; capture producers verify the pinned source identity')
    args = p.parse_args()
    if args.watchdog_seconds < 1:
        p.error('--watchdog-seconds must be positive')
    if args.jobs != 1:
        p.error('--jobs must be 1 for serial batches')
    if args.batch_size < 1 or args.batch_size > 80:
        p.error('--batch-size must be between 1 and 80')
    if args.batch_seconds < 1:
        p.error('--batch-seconds must be positive')
    work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']) / 'integration-run'
    work.mkdir(parents=True, exist_ok=True)
    root = pathlib.Path.cwd()
    files = args.files or discover_files(root)
    if not files:
        raise SystemExit('empty inventory')
    env = dict(os.environ, CHINOOK_DB='examples/browser/chinook.sqlite',
               JSQLITE_CHINOOK='examples/browser/chinook.sqlite')
    def git(*args):
        return subprocess.check_output(['git', *args])
    tracked = git('ls-files', '-z').decode().split('\0')
    hashes = {f: hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()
              for f in set(tracked + files + ['tools/test/integration.py', 'test/conformance/close-test-server.mjs'])
              if f and pathlib.Path(f).is_file()}
    report = dict(head=git('rev-parse', 'HEAD').decode().strip(),
                  status=git('status', '--porcelain').decode(),
                  index_sha256=hashlib.sha256(git('ls-files', '--stage', '-z')).hexdigest(),
                  inputs=hashes, files=files, node=subprocess.check_output(['node','--version'],text=True).strip(),
                  watchdog_seconds=args.watchdog_seconds, concurrency=args.jobs,
                  batch_size=args.batch_size, batch_seconds=args.batch_seconds,
                  prerequisites=[], results=[])
    def save():
        (work/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    save()
    work_root = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']).resolve()
    library = args.oracle_library.resolve() if args.oracle_library else work_root/'oracle-build/build/libsqlite3-oracle.so'
    commands = prerequisite_commands(files, library, work_root)
    if 'test/conformance/covered-deferred.test.mjs' in files:
        # Fresh planned output wins over any ambient capture from another run.
        env['COVERED_DEFERRED_DIR'] = str(work_root/'covered-deferred-native')
    for file, (_, output, variable) in COMPOUND_FIXTURES.items():
        if file in files:
            # Planned fresh outputs override ambient roots, never a fallback.
            env[variable] = str(work_root/output)
    # Fixture variables are invocation-owned, not ambient fallback inputs.
    env = {k:v for k,v in env.items() if k not in SELECT_FIXTURES}
    for key in selected_fixture_keys(files):
        env[key] = str(work_root/SELECT_FIXTURES[key][0])
    if commands:
        if args.oracle_library:
            report['oracle_library'] = dict(path=str(library), sha256=hashlib.sha256(library.read_bytes()).hexdigest())
        else:
            commands.insert(0, ['sh', 'tools/oracle/build.sh'])
        # Producer outputs are evidence: use a fresh purpose work root on rerun.
        # WR producer deliberately refuses to overwrite old fixtures.
        if any(pathlib.Path(f).name.startswith('skipscan-') for f in files):
            env['SKIPSCAN_NATIVE_ROOT'] = str(work_root/'skipscan-native')
        report['fixture_environment'] = {k:env[k] for k in ('SAIVAGE_CARD_WORK_ROOT','SKIPSCAN_NATIVE_ROOT','CHINOOK_DB','JSQLITE_CHINOOK','MULTI_OUTPUT_FIXTURES','WIDE_COMPOUND_FIXTURES','COVERED_DEFERRED_DIR', *SELECT_FIXTURES) if k in env}
        for i, command in enumerate(commands):
            result = component(command, work/f'prerequisite-{i}.log', 180, env)
            report['prerequisites'].append(result); save()
            if result['classification'] != 'completed':
                report['not_run'] = files; save(); return 1
        report['generated_inputs'] = {
            str(path.relative_to(work_root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for directory in ('r1-native', 'r2-native', 'skipscan-native', 'date-native', 'multi-output-native', 'wide-compound-native', 'covered-deferred-native', *(SELECT_FIXTURES[key][0] for key in selected_fixture_keys(files)))
            for path in sorted((work_root/directory).rglob('*')) if path.is_file()
        }
        if 'test/conformance/joined-order-boundary.test.mjs' in files:
            capture = work_root/'joined-order-boundary-native.json'
            report['generated_inputs'][capture.name] = hashlib.sha256(capture.read_bytes()).hexdigest()
        save()
    # Emit once sequentially before concurrent demo units launch a browser.
    # Direct units use the same owner; installed-demo roots are never rebuilt.
    if any(f in ('test/demo/entry.test.mjs', 'test/demo/browser.test.mjs') for f in files):
        result = component(['node', 'test/demo/prerequisite.mjs'], work/'demo-prerequisite.log', args.watchdog_seconds, env)
        report['prerequisites'].append(result); save()
        if result['classification'] != 'completed':
            report['not_run'] = files; save(); return 1
    run_batches(files, work, work_root, env, args.watchdog_seconds,
                args.batch_size, args.batch_seconds, report, save)
    report['input_drift'] = [f for f,h in hashes.items() if not pathlib.Path(f).is_file() or hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()!=h]
    # Generated paths are relative to the invocation work root, unlike source
    # inputs. Preserve actual component results; drift fails the aggregate.
    report['input_drift'].extend(
        str(work_root/f) for f,h in report.get('generated_inputs', {}).items()
        if not (work_root/f).is_file() or hashlib.sha256((work_root/f).read_bytes()).hexdigest()!=h)
    save()
    return int(bool(report['input_drift']) or bool(report['not_run']) or any(r['classification']!='completed' for r in report['results']))

if __name__ == '__main__':
    raise SystemExit(main())
