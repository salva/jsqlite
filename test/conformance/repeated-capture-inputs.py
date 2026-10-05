"""Development-only pin/body and frozen-output preflight for repeated captures."""
import hashlib
import json
import pathlib
import zipfile

SOURCE_PATHS = ['src/whereInt.h', 'src/where.c', 'src/wherecode.c',
                'src/select.c', 'src/resolve.c', 'src/vdbe.c',
                'src/vdbeaux.c', 'test/join8.test']

def preflight(root, outputs):
    # Check every output before opening any database or writing any JSON.
    for relative in outputs:
        path = root / 'test/conformance' / relative
        if path.exists():
            raise RuntimeError(f'refuse overwrite frozen output {path}')
    manifest = json.loads((root / 'reference/sqlite/manifest.json').read_text())
    base = root / 'reference/sqlite'
    archive = base / manifest['archive']
    raw = archive.read_bytes()
    if (len(raw) != manifest['bytes'] or
        hashlib.sha256(raw).hexdigest() != manifest['sha256'] or
        hashlib.sha3_256(raw).hexdigest() != manifest['sha3_256']):
        raise RuntimeError('SQLite archive differs from manifest')
    prefix = f"sqlite-src-{manifest['versionNumber']}/"
    with zipfile.ZipFile(archive) as z:
        for name in SOURCE_PATHS + ['VERSION', 'manifest.uuid']:
            body = (base / prefix / name).read_bytes()
            if body != z.read(prefix + name):
                raise RuntimeError(f'extracted pinned body differs: {name}')
    return manifest
