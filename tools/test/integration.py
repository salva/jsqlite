#!/usr/bin/env python3
"""Development-only bounded integration runner. A watchdog is failure, not credit."""
import argparse, concurrent.futures, hashlib, json, os, pathlib, signal, subprocess, time


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
    return dict(command=command, exit=code, classification='timeout' if timeout else
                'completed' if code == 0 else 'fail', seconds=round(time.monotonic()-start, 3),
                log=str(log), log_sha256=hashlib.sha256(log.read_bytes()).hexdigest())


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('files', nargs='*')
    p.add_argument('--jobs', type=int, default=1, help='positive file concurrency (default: serial; avoids resource contention)')
    args = p.parse_args()
    if args.jobs < 1:
        p.error('--jobs must be positive')
    work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']) / 'integration-run'
    work.mkdir(parents=True, exist_ok=True)
    root = pathlib.Path.cwd()
    files = args.files or sorted({str(f) for pattern in (
        'test/conformance/*.test.mjs', 'test/conformance/run-*-ts.mjs',
        'test/storage/*.test.mjs', 'test/parser/*.test.mjs') for f in root.glob(pattern)
        for f in [f.relative_to(root)]
        if f.name != 'run-audit-chinook-b1-b5-ts.mjs'})
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
                  watchdog_seconds=30, concurrency=args.jobs, prerequisites=[], results=[])
    def save():
        (work/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    save()
    # These two public suites explicitly require independently generated native fixtures.
    if any(pathlib.Path(f).name in ('where-operand-admission-public.test.mjs',
                                   'where-order-consumption-public.test.mjs') for f in files):
        library = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'oracle-build/build/libsqlite3-oracle.so'
        for i, command in enumerate([
            ['sh', 'tools/oracle/build.sh'],
            ['python3','test/conformance/capture-where-operand-admission.py','--library',str(library),'--output-dir',str(library.parents[2]/'r1-native')],
            ['python3','test/conformance/capture-where-order-consumption.py','--library',str(library),'--output-dir',str(library.parents[2]/'r2-native')],
        ]):
            result = component(command, work/f'prerequisite-{i}.log', 180, env)
            report['prerequisites'].append(result); save()
            if result['classification'] != 'completed':
                report['not_run'] = files; save(); return 1
    def run(pair):
        i, file = pair
        result = component(['node','--experimental-strip-types','--test',file], work/f'{i:03d}.log',30,env)
        result['file'] = file
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as executor:
        for result in executor.map(run, enumerate(files)):
            report['results'].append(result); save()
            print(result['classification'], result['exit'], result['file'], flush=True)
    report['input_drift'] = [f for f,h in hashes.items() if not pathlib.Path(f).is_file() or hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()!=h]
    save()
    return int(bool(report['input_drift']) or any(r['classification']!='completed' for r in report['results']))

if __name__ == '__main__':
    raise SystemExit(main())
