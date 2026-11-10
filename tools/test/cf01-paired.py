#!/usr/bin/env python3
"""Original CF01 native recipe plus independent public execution of its inputs."""
import json
import pathlib
import subprocess
import sys


def compare(native, public):
    assert len(native)==len(public)==63
    n={(r['enc'],r['sql']):r for r in native}
    p={(r['enc'],r['sql']):r for r in public}
    assert len(n)==len(p)==63 and n.keys()==p.keys()
    for key in n:
        assert len(n[key]['runs'])==len(p[key]['runs'])==2, key
        assert n[key]==p[key], (key,n[key],p[key])


def main():
    root,library,node,output=sys.argv[1:]
    here=pathlib.Path(__file__).resolve().parent
    native=subprocess.run([sys.executable,str(here/'cf01-native-capture.py'),root,library],capture_output=True,text=True,check=True,timeout=80)
    records=json.loads(native.stdout)
    # Do not expose oracle rows, metadata, errors or reset results to public runner.
    inputs=[dict(enc=r['enc'],sql=r['sql'],bindings=[run['bindings'] for run in r['runs']]) for r in records]
    public=subprocess.run([node,'--experimental-strip-types',str(here/'cf01-paired.mjs'),root],input=json.dumps(inputs),capture_output=True,text=True,check=True,timeout=80)
    compare(records,json.loads(public.stdout))
    target=pathlib.Path(output);target.mkdir(parents=True,exist_ok=True)
    (target/'native.json').write_text(native.stdout)
    (target/'public.json').write_text(public.stdout)
    print('CF01 original recipe: 63 typed/metadata/bind/two-reset/error pairs match')


if __name__=='__main__':main()
