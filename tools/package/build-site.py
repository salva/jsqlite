"""Build a static site with the accepted alpha engine, never a dirty runtime overlay."""
from pathlib import Path
import hashlib
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
    query = (source / 'examples/browser/query.js').read_text()
    query = query.replace("'../../dist/index.js'", "'./engine/index.js'")
    # Demo wrapper policy, not a change to the pinned engine.
    query = query.replace('timeoutMs: 10000', 'timeoutMs: 60000')
    query_name = 'query-' + hashlib.sha256(query.encode()).hexdigest()[:12] + '.js'
    # Content-address the UI/worker so Pages' ten-minute cache cannot retain
    # a previous worker after deployment. Engine inputs are pinned separately.
    worker_text = (OUT / 'worker.js').read_text().replace("'./assets/query.js'", repr('./assets/' + query_name))
    worker_name = 'worker-' + hashlib.sha256(worker_text.encode()).hexdigest()[:12] + '.js'
    (OUT / worker_name).write_text(worker_text)
    app_text = (OUT / 'app.js').read_text().replace("'worker.js'", repr(worker_name))
    app_name = 'app-' + hashlib.sha256(app_text.encode()).hexdigest()[:12] + '.js'
    (OUT / app_name).write_text(app_text)
    css = (OUT / 'style.css').read_bytes()
    css_name = 'style-' + hashlib.sha256(css).hexdigest()[:12] + '.css'
    (OUT / css_name).write_bytes(css)
    html = (OUT / 'index.html').read_text().replace('src="app.js"', f'src="{app_name}"').replace('href="style.css"', f'href="{css_name}"')
    (OUT / 'index.html').write_text(html)
    assets = OUT / 'assets'
    assets.mkdir()
    shutil.copytree(source / 'dist', assets / 'engine')
    for name in ['chinook.sqlite', 'CHINOOK-LICENSE.md']:
        shutil.copyfile(source / 'examples/browser' / name, assets / name)
    (assets / query_name).write_text(query)
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
