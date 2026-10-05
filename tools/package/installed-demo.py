#!/usr/bin/env python3
"""Run the static demo against an independently installed private local tarball.
Scaffold evidence only; never certifies stabilized alpha or changes engine inputs.
"""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def inventory(root):
    return {str(p.relative_to(root)): sha(p) for p in sorted(root.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-manifest', required=True)
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    if not re.fullmatch('[a-z][a-z0-9-]*', args.name) or args.name in ('tmp', 'processes'):
        parser.error('--name must be a purpose-named child, not a reserved directory')
    manifest = pathlib.Path(args.package_manifest).resolve()
    package = json.loads(manifest.read_text())
    if package['private'] is not True or not re.fullmatch(r'0\.0\.0-alpha\.[1-9][0-9]*', package['version']):
        raise ValueError('requires a private versioned local alpha manifest')
    origin = manifest.parent
    tarball = origin / package['artifact']['filename']
    if sha(tarball) != package['artifact']['sha256']:
        raise ValueError('tarball digest mismatch')
    source = origin / 'source'
    demo = source / 'examples/browser'
    inputs = inventory(demo)
    for p, h in inputs.items():
        if package['trackedInputs'].get('examples/browser/' + p) != h:
            raise ValueError('exported demo input mismatch: ' + p)
    if not inputs or not (demo / 'query.js').is_file():
        raise ValueError('explicit package source has no demo')
    work = pathlib.Path(os.environ['SAIVAGE_CARD_WORK_ROOT']).resolve() / args.name
    work.mkdir()
    shutil.copytree(demo, work / 'examples/browser')
    (work / 'package.json').write_text('{"private":true,"type":"module"}\n')
    report = dict(status='scaffold-only-not-certified', sourceCommit=package['sourceCommit'],
                  sourceTree=package['sourceTree'], version=package['version'],
                  packageManifestSha256=sha(manifest), artifactSha256=sha(tarball),
                  demoInputs=inputs, toolingSha256=sha(pathlib.Path(__file__)), commands=[],
                  pending=['stabilized reviewed exact source', 'STAT4/core admission gate resolution',
                           'fresh candidate native evidence and installed-artifact browser rerun', 'alpha acceptance'])
    output = work / 'installed-demo-manifest.json'
    def save():
        output.write_text(json.dumps(report, indent=2) + '\n')
    def run(cmd, env):
        result = subprocess.run(cmd, cwd=work, env=env, capture_output=True)
        n = len(report['commands'])
        stdout = work / f'{n:02d}.stdout'; stderr = work / f'{n:02d}.stderr'
        stdout.write_bytes(result.stdout); stderr.write_bytes(result.stderr)
        report['commands'].append(dict(command=cmd, exit=result.returncode,
                                       stdout=str(stdout), stdoutSha256=sha(stdout),
                                       stderr=str(stderr), stderrSha256=sha(stderr)))
        save()
        if result.returncode:
            raise RuntimeError(f'check failed; see {output}')
    save()
    env = dict(os.environ, npm_config_cache=str(work/'npm-cache'), npm_config_update_notifier='false')
    run(['npm', 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', str(tarball)], env)
    installed = work / 'node_modules/jsqlite2'
    if inventory(installed) != package['artifact']['contents']:
        raise ValueError('installed package differs from recorded packed closure')
    query = work / 'examples/browser/query.js'
    text = query.read_text()
    if text.count("from '../../dist/index.js'") != 1:
        raise ValueError('unexpected demo import; refuses unrecorded rewriting')
    query.write_text(text.replace("from '../../dist/index.js'", "from '../../node_modules/jsqlite2/dist/index.js'"))
    report['importOverlay'] = {'path': 'examples/browser/query.js', 'sha256': sha(query),
                              'description': 'Only engine import points to independently installed tarball; no engine overlay'}
    report['installedContents'] = inventory(installed)
    root = pathlib.Path(__file__).resolve().parents[2]
    harness = root / 'test/demo/browser.test.mjs'
    report['browserHarnessSha256'] = sha(harness)
    env['JSQLITE_DEMO_ROOT'] = str(work)
    run(['node', str(harness)], env)
    report['postRunInstalledDrift'] = inventory(installed) != report['installedContents']
    report['postRunDemoDrift'] = {p: h for p, h in inventory(work/'examples/browser').items()
                                  if h != (report['importOverlay']['sha256'] if p == 'query.js' else inputs.get(p))}
    save()
    if report['postRunInstalledDrift'] or report['postRunDemoDrift']:
        raise ValueError('post-run input drift')
    print(json.dumps({'manifest': str(output), 'manifestSha256': sha(output),
                      'status': report['status'], 'artifactSha256': report['artifactSha256']}, indent=2))


if __name__ == '__main__':
    main()
