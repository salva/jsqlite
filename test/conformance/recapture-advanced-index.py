#!/usr/bin/env python3
import argparse,pathlib,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
def main():
 p=argparse.ArgumentParser();p.add_argument('--library',required=True);p.add_argument('--output');a=p.parse_args();out=pathlib.Path(a.output) if a.output else ROOT/'test/conformance/cases/stage3-advanced-index.json'
 cmd=[sys.executable,str(ROOT/'test/conformance/capture-advanced-index.py'),'--library',a.library,'--output',str(out)]
 subprocess.run(cmd,check=True)
if __name__=='__main__':main()
