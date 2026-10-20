"""Pinned C API mixed module RIGHT/FULL capture; reuse typed/reset recorder."""
import pathlib
root=pathlib.Path(__file__).resolve().parents[3]
path=root/'docs/research/recursive-join/right-full-native.py'
recorder=path.read_text()
start=recorder.index("prefix='WITH RECURSIVE")
end=recorder.index('results=[]',start)
cases=[]
for join in ['RIGHT','FULL']:
 for module in ['json_each','json_tree','jsonb_each','jsonb_tree']:
  for arg in ["'[7,7,9]'","'[]'","NULL","jsonb('[7,7,9]')"]:
   cases.append(f'SELECT t.id,j.rowid,j.value FROM t {join} JOIN {module}({arg}) j ON t.id=j.value')
  for on in ['0','NULL','t.id=j.value']:
   for where in ['', ' WHERE t.id IS NULL',' WHERE j.value=7']:
    cases.append(f"SELECT t.id,j.rowid,j.value FROM t {join} JOIN {module}('[7,7,9]') j ON {on}{where}")
  cases.append(f"SELECT j.rowid,j.value,t.id FROM {module}('[7,7,9]') j {join} JOIN t ON t.id=j.value")
  cases.append(f"SELECT j.rowid,j.value,t.id FROM {module}('[]') j {join} JOIN t ON t.id=j.value")
 for arg in ["'[7,7,9]'","'[]'"]:
  cases.append(f'SELECT t.id,j.value FROM t {join} JOIN json_each({arg}) j ON t.id=j.value')
 cases.append(f"SELECT DISTINCT t.id,j.value FROM t {join} JOIN json_each('[7,7,9]') j ON t.id=j.value ORDER BY j.value LIMIT 2")
 cases.append(f"SELECT t.id,a.rowid,a.value,b.rowid,b.value FROM t {join} JOIN json_each('[7,7,9]') a ON t.id=a.value FULL JOIN json_each('[7,9,9]') b ON a.value=b.value")
 cases.append(f"SELECT * FROM json_each('[7,9]') a {join} JOIN json_each('[7,8]') b USING(value) ORDER BY value,a.key,b.key")
 cases.append(f"SELECT * FROM json_each('[7,9]') a NATURAL {join} JOIN json_each('[7,8]') b ORDER BY value,a.key,b.key")
 cases.append(f"SELECT t.id,j.value FROM t {join} JOIN json_each(CASE WHEN t.id IS NULL THEN '[9]' ELSE '[7]' END) j ON 0 ORDER BY t.id,j.value")
 cases.append(f"SELECT t.id,j.rowid,j.value FROM t {join} JOIN json_each(t.id) j ON 1")
recorder=recorder[:start]+'cases='+repr(cases)+'\n'+recorder[end:]
recorder=recorder.replace("root/f'test/fixtures/recursive-join/{encoding}-corrected.sqlite'","root/f'test/conformance/fixtures/row-width-ipk-{encoding.lower()}.db'")
# Retain prepare/step/reset/finalize ownership for invalid forward arguments
# and malformed JSON rather than conflating every error with prepare failure.
recorder=recorder.replace('print(json.dumps(dict(sourceId=source,cases=results),indent=2))','')
ns={'__file__':str(path),'__name__':'__main__'}
exec(compile(recorder,str(path),'exec'),ns)
C,l,P=ns['C'],ns['l'],ns['P']
l.sqlite3_errmsg.argtypes=[P];l.sqlite3_errmsg.restype=C.c_char_p
errors=[]
for encoding in ['UTF-8','UTF-16le','UTF-16be']:
 d=P();assert l.sqlite3_open(str(root/f'test/conformance/fixtures/row-width-ipk-{encoding.lower()}.db').encode(),C.byref(d))==0
 try:
  for join in ['RIGHT','FULL']:
   sqls=[f"SELECT t.id,j.value FROM t {join} JOIN json_each({arg}) j ON 1 JOIN json_each('[7]') k ON 1" for arg in ['k.value','(SELECT k.value)','(SELECT 1 UNION ALL SELECT k.value)']]
   sqls += [f"SELECT t.id,j.value FROM t {join} JOIN json_each('[broken') j ON 0"]
   for sql in sqls:
    s=P();rc=l.sqlite3_prepare_v2(d,sql.encode(),-1,C.byref(s),None)
    item=dict(encoding=encoding,sql=sql,prepare=rc)
    if rc:
     item['message']=l.sqlite3_errmsg(d).decode();assert not s.value
    else:
     item['step']=l.sqlite3_step(s);item['message']=l.sqlite3_errmsg(d).decode()
     item['reset']=l.sqlite3_reset(s);item['finalize']=l.sqlite3_finalize(s)
    errors.append(item)
 finally:assert l.sqlite3_close(d)==0
import json
print(json.dumps(dict(sourceId=ns['source'],cases=ns['results'],errors=errors),indent=2))
