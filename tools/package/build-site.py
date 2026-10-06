"""Build a static site with the accepted alpha engine, never a dirty runtime overlay."""
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
ALPHA = '1984a9a4581746f5fb12e66ae03fad3451bf45bc'
OUT = ROOT / '_site'

def run(*args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)

scratch = ROOT / '.site-build'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as temporary:
    source = Path(temporary)
    archive = source / 'alpha.tar'
    with archive.open('wb') as stream:
        subprocess.run(['git', 'archive', ALPHA], cwd=ROOT, stdout=stream, check=True)
    with tarfile.open(archive) as stream:
        stream.extractall(source, filter='data')
    run('npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund', cwd=source)
    run('npm', 'run', 'build', cwd=source)
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / 'site', OUT)
    assets = OUT / 'assets'
    assets.mkdir()
    shutil.copytree(source / 'dist', assets / 'engine')
    for name in ['chinook.sqlite', 'CHINOOK-LICENSE.md']:
        shutil.copyfile(source / 'examples/browser' / name, assets / name)
    query = (source / 'examples/browser/query.js').read_text()
    query = query.replace("'../../dist/index.js'", "'./engine/index.js'")
    (assets / 'query.js').write_text(query)
    for name in ['LICENSE', 'NOTICE.md']:
        shutil.copyfile(ROOT / name, OUT / name)
    # Include preferred source for the pinned engine and the site/build itself.
    # Only committed files are included; caches and runtime state stay excluded.
    site_archive = source / 'site-source.tar'
    with site_archive.open('wb') as stream:
        subprocess.run(['git', 'archive', 'HEAD'], cwd=ROOT, stdout=stream, check=True)
    with tarfile.open(OUT / 'source.tar.gz', 'w:gz') as bundle:
        with tarfile.open(archive) as engine:
            for member in engine.getmembers():
                member.name = 'engine/' + member.name
                bundle.addfile(member, engine.extractfile(member) if member.isfile() else None)
        with tarfile.open(site_archive) as website:
            for member in website.getmembers():
                member.name = 'website/' + member.name
                bundle.addfile(member, website.extractfile(member) if member.isfile() else None)
        for name in ['LICENSE', 'NOTICE.md']:
            bundle.add(ROOT / name, arcname=name)
    (OUT / '.nojekyll').touch()
print(f'Static site: {OUT}; engine pinned to {ALPHA}')
