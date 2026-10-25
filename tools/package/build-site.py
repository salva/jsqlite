"""Build a static site with the accepted release engine, never dirty runtime."""
from pathlib import Path
import hashlib
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
RELEASE = 'd06c8e621814463d232052b14255ae7192f215d9'
PACKAGE = ROOT / 'tools/package/releases/jsqlite2-0.0.0-beta.5.tgz'
PACKAGE_SHA256 = 'f51e3cfb7548d77cde0de20d9321ae76114c3a91a97565b741329866594a9665'
OUT = ROOT / '_site'

def run(*args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)

scratch = ROOT / '.site-build'
scratch.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(dir=scratch) as temporary:
    source = Path(temporary)
    archive = source / 'release.tar'
    with archive.open('wb') as stream:
        subprocess.run(['git', 'archive', RELEASE], cwd=ROOT, stdout=stream, check=True)
    with tarfile.open(archive) as stream:
        stream.extractall(source, filter='data')
    # Deploy the independently accepted package bytes, not a fresh compilation.
    assert hashlib.sha256(PACKAGE.read_bytes()).hexdigest() == PACKAGE_SHA256
    with tarfile.open(PACKAGE) as package:
        package.extractall(source / 'packed', filter='data')
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / 'site', OUT, ignore=shutil.ignore_patterns('legacy-assets'))
    # Cached alpha workers/imports remain available at their immutable URLs.
    shutil.copytree(ROOT / 'site/legacy-assets', OUT, dirs_exist_ok=True)
    query = (source / 'examples/browser/query.js').read_text()
    engine_name = 'engine-' + RELEASE[:12]
    query = query.replace("'../../dist/index.js'", repr('./' + engine_name + '/index.js'))
    # Demo wrapper policy, not a change to the pinned engine.
    query = query.replace('timeoutMs: 10000', 'timeoutMs: 60000')
    query_name = 'query-' + hashlib.sha256(query.encode()).hexdigest()[:12] + '.js'
    # Content-address the UI/worker so Pages' ten-minute cache cannot retain
    # a previous worker after deployment. Engine inputs are pinned separately.
    worker_text = (OUT / 'worker.js').read_text().replace("'./assets/query.js'", repr('./assets/' + query_name))
    worker_name = 'worker-' + hashlib.sha256(worker_text.encode()).hexdigest()[:12] + '.js'
    (OUT / worker_name).write_text(worker_text)
    examples = (OUT / 'examples.js').read_bytes()
    examples_name = 'examples-' + hashlib.sha256(examples).hexdigest()[:12] + '.js'
    (OUT / examples_name).write_bytes(examples)
    app_text = (OUT / 'app.js').read_text().replace("'worker.js'", repr(worker_name))
    app_text = app_text.replace("'./examples.js'", repr('./' + examples_name))
    app_name = 'app-' + hashlib.sha256(app_text.encode()).hexdigest()[:12] + '.js'
    (OUT / app_name).write_text(app_text)
    css = (OUT / 'style.css').read_bytes()
    css_name = 'style-' + hashlib.sha256(css).hexdigest()[:12] + '.css'
    (OUT / css_name).write_bytes(css)
    html = (OUT / 'index.html').read_text().replace('src="app.js"', f'src="{app_name}"').replace('href="style.css"', f'href="{css_name}"')
    (OUT / 'index.html').write_text(html)
    assets = OUT / 'assets'
    assets.mkdir(exist_ok=True)
    shutil.copytree(source / 'packed/package/dist', assets / engine_name)
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
print(f'Static site: {OUT}; engine pinned to {RELEASE}')
