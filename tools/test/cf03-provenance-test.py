#!/usr/bin/env python3
"""Source/profile regressions using actual separately compiled negative libraries.

usage: python3 tools/test/cf03-provenance-test.py ROOT GOOD WRONG_SOURCE WRONG_PROFILE
See card evidence for pinned deterministic compiler commands. No sibling profiles.
"""
import ctypes
import importlib.util
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
good, wrong_source, wrong_profile = map(pathlib.Path, sys.argv[2:])
spec = importlib.util.spec_from_file_location('provenance', root/'docs/research/cf03-native-provenance.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
pin = json.loads((root/'reference/sqlite/manifest.json').read_text())
p.qualify(root, good)
for path, reason in ((wrong_source, 'wrong source'), (wrong_profile, 'wrong profile')):
    # Exercise source/profile owner directly, in addition to the public producer's
    # stronger pre-dlopen build identity rejection. No monkeypatch or fake profile.
    try:
        p.profile(ctypes.CDLL(str(path.resolve())), pin)
    except AssertionError as error:
        assert reason in str(error), (reason, error)
    else:
        raise AssertionError(f'{reason} was accepted')
    result = subprocess.run([sys.executable, str(root/'docs/research/cf03-cte-native.py'),
                             str(root), str(path)], capture_output=True, text=True)
    assert result.returncode != 0 and not result.stdout
    assert 'unqualified library build/profile' in result.stderr, result.stderr
    print(reason+': profile owner and actual producer reject before SQL')
print('qualified supplied library: PASS')
