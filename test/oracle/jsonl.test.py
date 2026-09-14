#!/usr/bin/env python3
import base64,json,os,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]; fixtures=root/"test/fixtures"; cur=json.loads((fixtures/"CURRENT.json").read_text()); case=fixtures/"generations"/cur["generationId"]
cmd=[sys.executable,str(root/"tools/oracle/jsonl-oracle.py"),"--library",os.environ["SAIVAGE_CARD_WORK_ROOT"]+"/oracle-build/build/libsqlite3-oracle.so","--profile",os.environ["SAIVAGE_CARD_WORK_ROOT"]+"/oracle-build/profile.json","--case-root",str(case)]
def B(s):
 x=s.encode(); return {"encoding":"base64","bytes":len(x),"data":base64.b64encode(x).decode()}
requests=[
 {"op":"hello"}, {"op":"open","path":"generated/readonly.db","flags":"readonly","uri":False},
 {"op":"prepare","db":1,"sql":B("SELECT ?;SELECT 2"),"byteLimit":-1},
 {"op":"bind","stmt":2,"index":1,"value":{"kind":"integer","decimal":"9223372036854775807"}},
 {"op":"step","stmt":2},{"op":"reset","stmt":2},{"op":"clearBindings","stmt":2},{"op":"step","stmt":2},{"op":"finalize","stmt":2},{"op":"close","db":1,"mode":"v2"}]
for i,q in enumerate(requests): q.update(schema="jsqlite-oracle/1",seq=i)
p=subprocess.run(cmd,input="".join(json.dumps(x)+"\n" for x in requests),text=True,capture_output=True); assert p.returncode==0,p.stderr
rows=[json.loads(x) for x in p.stdout.splitlines()]; assert len(rows)==len(requests); assert all(x["outcome"]=="ok" for x in rows)
assert rows[2]["result"]["tail"]["data"]==base64.b64encode(b"SELECT 2").decode(); assert rows[4]["result"]["row"][0]["value"]["decimal"]=="9223372036854775807"; assert rows[7]["result"]["row"][0]["value"]["kind"]=="null"; assert rows[-1]["result"]["destroyed"] is True
bad={"schema":"jsqlite-oracle/1","seq":0,"op":"open","path":"../escape","flags":"readonly","uri":False}; p=subprocess.run(cmd,input=json.dumps(bad)+"\n",text=True,capture_output=True); assert p.returncode==2; assert json.loads(p.stdout)["outcome"]=="protocol-error"
print("JSONL operation sequence passed: hello/open/prepare-tail/bind/step/reset/clear/step/finalize/close and path rejection")
