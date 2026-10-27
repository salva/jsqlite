#!/usr/bin/env python3
"""Validate the source-owned Q21 receipt, not a second fixture producer."""
import hashlib
import json
import pathlib
import sys


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def verify(output, library):
    root = pathlib.Path.cwd()
    output = pathlib.Path(output)
    library = pathlib.Path(library).resolve()
    receipt = json.loads((output/'receipt.json').read_text())
    assert receipt['schema'] == 'expression-boundary-capture/1'
    generation = json.loads((root/'test/fixtures/CURRENT.json').read_text())['generationId']
    assert receipt['generation'] == generation
    for file, digest in receipt['files'].items():
        assert sha(root/file) == digest, ('source drift', file)
    assert receipt['executables'][str(library)] == sha(library)
    for executable, digest in receipt['executables'].items():
        assert sha(executable) == digest, ('executable drift', executable)
    commands = receipt['commands']
    assert len(commands) == 9
    helper = str(library.parent/'sqlite-fixture')
    node = commands[4]['argv'][0]
    # Require identity for all consumed executables, not an arbitrary subset.
    assert {str(library), helper, str(pathlib.Path(node).resolve())} <= set(receipt['executables'])
    for command in commands:
        assert command['exit'] == 0
        assert sha(output/command['output']) == command['sha256']
    for index, (enc, encoding) in enumerate((('utf8','UTF-8'), ('utf16le','UTF-16le'), ('utf16be','UTF-16be'))):
        db = output/f'subquery-{enc}.db'
        consumed = f'test/fixtures/generations/{generation}/generated/subquery-{enc}.db'
        assert sha(db) == receipt['files'][consumed] == sha(root/consumed)
        assert commands[index]['argv'] == [str(library.parent/'sqlite-fixture'), f'subquery-{enc}', encoding, str(db)]
    for index, stem in enumerate(('select-collate-scalar-width', 'function-descriptor-resolution', 'function-registration-boundaries')):
        native = f'test/conformance/{stem}-native.py'
        public = f'test/conformance/{stem}.test.mjs'
        assert commands[3+index*2]['argv'][1:] == [native, str(library)]
        assert commands[4+index*2]['argv'][1:] == ['--experimental-strip-types', '--test', '--test-concurrency=1', '--test-timeout=100000', public]
        assert commands[4+index*2]['argv'][0] == node
        assert native in receipt['files'] and public in receipt['files']
    print('Q21 paired receipt and three consumed DB identities verified')


if __name__ == '__main__':
    verify(sys.argv[1], sys.argv[2])
