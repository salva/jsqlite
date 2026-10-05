#!/usr/bin/env python3
"""Private local alpha scaffold from an explicit commit, never the worktree/index.

This builds evidence, not certification. Reviewed source and stabilized candidate
acceptance are supplied by integration/review owners, never inferred here.
"""
import argparse, hashlib, json, os, pathlib, re, subprocess, tarfile


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(root):
    return {str(p.relative_to(root)): digest(p) for p in sorted(root.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--commit', required=True, help='explicit full reviewed candidate or scaffold source commit')
    parser.add_argument('--version', required=True, help='private local semver, e.g. 0.0.0-alpha.1')
    parser.add_argument('--name', required=True, help='new purpose-named output directory')
    parser.add_argument('--offline', action='store_true', help='npm ci using existing cache only')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.commit):
        parser.error('--commit must be a full commit SHA, not HEAD or a moving ref')
    if not re.fullmatch(r'0\.0\.0-alpha\.[1-9][0-9]*', args.version):
        parser.error('--version must be 0.0.0-alpha.N; no release-version implication')
    if not re.fullmatch(r'[a-z][a-z0-9-]*', args.name):
        parser.error('--name must be a purpose-named child directory')
    root = pathlib.Path(__file__).resolve().parents[2]
    work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']).resolve() / args.name
    # Exclusive creation prevents silently overwriting an earlier candidate's evidence.
    work.mkdir()
    source = work / 'source'
    source.mkdir()
    commands = []
    report = dict(schemaVersion=1, status='scaffold-only-not-certified', version=args.version,
                  private=True, sourceCommit=args.commit, commands=commands,
                  toolingSha256=digest(pathlib.Path(__file__).resolve()),
                  pending=['reviewed stabilized source approval', 'STAT4/core integration recapture',
                           'pinned native/reference recapture', 'actual-artifact independent consumer types/real-browser Fetch',
                           'demo artifact recapture', 'integration acceptance'])
    manifest = work / 'local-alpha-manifest.json'

    def save():
        manifest.write_text(json.dumps(report, indent=2) + '\n')

    def run(command, cwd=root, env=None):
        result = subprocess.run(command, cwd=cwd, env=env, capture_output=True)
        number = len(commands)
        stdout, stderr = work/f'{number:02d}.stdout', work/f'{number:02d}.stderr'
        stdout.write_bytes(result.stdout); stderr.write_bytes(result.stderr)
        commands.append(dict(command=list(map(str, command)), cwd=str(cwd), exit=result.returncode,
                             stdout=str(stdout), stdoutSha256=digest(stdout),
                             stderr=str(stderr), stderrSha256=digest(stderr)))
        save()
        if result.returncode:
            raise RuntimeError(f'command failed ({result.returncode}): {command}; see {manifest}')
        return result.stdout

    save()
    report['sourceTree'] = run(['git', 'rev-parse', args.commit+'^{tree}']).decode().strip()
    tracked = run(['git', 'ls-tree', '-r', '--name-only', args.commit]).decode().splitlines()
    archive = work/'source.tar'
    run(['git', 'archive', '--format=tar', '-o', str(archive), args.commit])
    report['sourceArchiveSha256'] = digest(archive)
    with tarfile.open(archive) as tar:
        # Git archive of project tracked source, no symlink/path escape acceptance.
        for member in tar.getmembers():
            if member.issym() or member.islnk() or member.name.startswith('/') or '..' in pathlib.PurePosixPath(member.name).parts:
                raise ValueError(f'unsafe source archive entry {member.name}')
        tar.extractall(source, filter='data')
    hashes = {p: digest(source/p) for p in tracked if (source/p).is_file()}
    report['trackedInputs'] = hashes
    report['referencePin'] = json.loads((source/'reference/sqlite/manifest.json').read_text())
    report['fixtureCurrent'] = json.loads((source/'test/fixtures/CURRENT.json').read_text())
    generation = report['fixtureCurrent']['generationId']
    report['fixtureInventory'] = inventory(source/'test/fixtures/generations'/generation)
    if not report['fixtureInventory']:
        raise ValueError('CURRENT fixture generation is absent from explicit commit')
    # Native/reference archives are intentionally not copied from dirty or ignored
    # workspace state. Candidate integration must attach independently captured pin evidence.
    report['nativeReferenceEvidence'] = {'status': 'pending', 'required': ['archiveSha256', 'extractedSourceInventorySha256', 'nativeProfileSha256', 'nativeLibrarySha256', 'sqliteSourceId']}
    package = source/'package.json'
    lock = source/'package-lock.json'
    pkg = json.loads(package.read_text()); locks = json.loads(lock.read_text())
    if pkg.get('private') is not True:
        raise ValueError('source package must remain private')
    pkg['version'] = args.version
    locks['version'] = args.version; locks['packages']['']['version'] = args.version
    package.write_text(json.dumps(pkg, indent=2)+'\n'); lock.write_text(json.dumps(locks, indent=2)+'\n')
    report['controlledOverlay'] = {p: digest(source/p) for p in ('package.json', 'package-lock.json')}
    report['overlayDescription'] = 'Only package and lock root version set to explicit alpha version; no engine/source overlay'
    # Shared dependency cache stays scoped under the supplied work root.
    env = dict(os.environ,
               npm_config_cache=str(pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT'])/'alpha-npm-cache'),
               npm_config_update_notifier='false')
    run(['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'] + (['--offline'] if args.offline else []), source, env)
    run(['npm', 'run', 'build'], source, env)
    packed = json.loads(run(['npm', 'pack', '--json', '--pack-destination', str(work)], source, env))[0]
    tarball = work/packed['filename']
    extracted = work/'package'; extracted.mkdir()
    with tarfile.open(tarball) as tar:
        for member in tar.getmembers():
            if member.issym() or member.islnk() or member.name.startswith('/') or '..' in pathlib.PurePosixPath(member.name).parts:
                raise ValueError(f'unsafe package archive entry {member.name}')
        tar.extractall(extracted, filter='data')
    contents = inventory(extracted/'package')
    if any(not re.fullmatch(r'(package\.json|README\.md|dist/.+\.(js|d\.ts))', p) for p in contents):
        raise ValueError('unexpected packed content')
    report['artifact'] = dict(filename=packed['filename'], sha256=digest(tarball),
                              integrity=packed['integrity'], packedBytes=packed['size'],
                              unpackedBytes=packed['unpackedSize'], contents=contents)
    # Independently install the actual tarball; never rely on source self-import.
    consumer = work/'consumer'; consumer.mkdir()
    (consumer/'package.json').write_text('{"private":true,"type":"module"}\n')
    run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', str(tarball)], consumer, env)
    (consumer/'probe.mjs').write_text("import {open,JSQLiteError} from 'jsqlite2'; if(typeof open!=='function'||new JSQLiteError('misuse','x').kind!=='misuse')throw Error('exports');\n")
    run(['node', 'probe.mjs'], consumer, env)
    (consumer/'probe.ts').write_text((source/'test-d/api.test.ts').read_text().replace('../src/index.js', 'jsqlite2'))
    run(['node', str(source/'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'ES2022', '--module', 'NodeNext', '--exactOptionalPropertyTypes', 'probe.ts'], consumer, env)
    report['unexpectedInputDrift'] = [p for p,h in hashes.items() if p not in report['controlledOverlay'] and (not (source/p).is_file() or digest(source/p)!=h)]
    if report['unexpectedInputDrift']:
        raise ValueError('exported source input drift')
    save()
    print(json.dumps(dict(manifest=str(manifest), manifestSha256=digest(manifest),
                          status=report['status'], sourceCommit=args.commit, sourceTree=report['sourceTree'],
                          artifactSha256=report['artifact']['sha256']), indent=2))


if __name__ == '__main__':
    main()
