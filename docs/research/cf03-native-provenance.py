"""CF03's bounded Linux oracle qualification, not a general native loader.

979c remains the historical capture identity. Fresh builds may differ in DWARF
paths/build-id only: authenticate all allocated ELF sections against the
independently source-verified build, then inspect the *consumed* library profile.
Unknown platforms/compiler output fail closed and require new author evidence.
"""
import ctypes as C
import hashlib
import json
import pathlib
import struct
import subprocess
import sys

HISTORICAL = '979c43433a9a9cdfbaaf6bae7dc0fe53eff80b05112aa40d9febfa381c00d020'
ARCHIVE = 'd18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b'
# G16 build.sh, GCC13.3 x86_64: independently rebuilt; see cf03 evidence.
ALLOCATED = '5d3d3c329c6d4dd70b83f7417a83e43032ee22b0810773b058fa3f83c9627197'


def allocated_digest(raw):
    assert raw[:6] == b'\x7fELF\x02\x01', 'CF03 requires qualified ELF64 little-endian build'
    assert struct.unpack_from('<H', raw, 18)[0] == 62, 'CF03 requires x86_64'
    offset = struct.unpack_from('<Q', raw, 40)[0]
    size, count, strings_index = struct.unpack_from('<HHH', raw, 58)
    assert size == 64 and 0 < strings_index < count
    def section(i):
        return struct.unpack_from('<IIQQQQIIQQ', raw, offset + size*i)
    table = section(strings_index)
    strings = raw[table[4]:table[4]+table[5]]
    digest = hashlib.sha256()
    for i in range(count):
        s = section(i)
        name = strings[s[0]:].split(b'\0')[0]
        if s[2] & 2 and name != b'.note.gnu.build-id':
            assert s[1] == 8 or s[4]+s[5] <= len(raw)
            data = raw[s[4]:s[4]+s[5]] if s[1] != 8 else b''
            digest.update(name+b'\0'+str((s[1], s[2], s[3], s[5], s[8])).encode()+b'\0'+data)
    return digest.hexdigest()


def profile(lib, pin):
    for name in ('sourceid', 'libversion'):
        getattr(lib, 'sqlite3_'+name).restype = C.c_char_p
    lib.sqlite3_libversion_number.restype = C.c_int
    assert lib.sqlite3_sourceid().decode() == pin['sqliteSourceId'], 'CF03 wrong source'
    assert lib.sqlite3_libversion().decode() == pin['version'], 'CF03 wrong version'
    major, minor, patch = map(int, pin['version'].split('.'))
    assert lib.sqlite3_libversion_number() == major*1000000+minor*1000+patch, 'CF03 wrong version number'
    lib.sqlite3_compileoption_used.argtypes = [C.c_char_p]
    lib.sqlite3_compileoption_used.restype = C.c_int
    required = ('ENABLE_COLUMN_METADATA', 'ENABLE_MATH_FUNCTIONS')
    forbidden = ('OMIT_JSON', 'OMIT_UTF16', 'OMIT_FLOATING_POINT', 'OMIT_AUTORESET')
    assert all(lib.sqlite3_compileoption_used(n.encode()) for n in required), 'CF03 wrong profile: required feature'
    assert not any(lib.sqlite3_compileoption_used(n.encode()) for n in forbidden), 'CF03 wrong profile: omitted feature'
    return {'required': required, 'forbidden': forbidden}


def qualify(root, path):
    pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
    assert pin['sha256'] == ARCHIVE, 'CF03 archive pin changed'
    subprocess.run([sys.executable, str(root/'tools/oracle/verify-source.py'),
                    str(root/'reference/sqlite/manifest.json')], check=True, stdout=subprocess.DEVNULL)
    # verify-source authenticates the archive; compare every extracted member too,
    # not just VERSION/manifest.uuid, before using source identity in receipts.
    import zipfile
    with zipfile.ZipFile(root/'reference/sqlite'/pin['archive']) as archive:
        for member in archive.infolist():
            if not member.is_dir():
                assert (root/'reference/sqlite'/member.filename).read_bytes() == archive.read(member), 'CF03 extracted source differs'
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    # Authenticate executable/data bytes BEFORE dlopen. Never trust sibling profile.json.
    if sha != HISTORICAL:
        assert allocated_digest(raw) == ALLOCATED, 'CF03 unqualified library build/profile'
    lib = C.CDLL(str(path.resolve()))
    features = profile(lib, pin)
    return lib, {'librarySha256': sha, 'historicalLibrarySha256': HISTORICAL,
                 'archiveSha256': ARCHIVE, 'sourceId': pin['sqliteSourceId'],
                 'version': pin['version'], 'profile': features,
                 'qualification': 'historical-exact' if sha == HISTORICAL else 'allocated-ELF-GCC13.3',
                 'allocatedSha256': None if sha == HISTORICAL else ALLOCATED}
