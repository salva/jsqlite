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
 cases.append(f"SELECT t.id,j.rowid,j.value FROM t {join} JOIN json_each(t.id) j ON 1")
recorder=recorder[:start]+'cases='+repr(cases)+'\n'+recorder[end:]
recorder=recorder.replace("root/f'test/fixtures/recursive-join/{encoding}-corrected.sqlite'","root/f'test/conformance/fixtures/row-width-ipk-{encoding.lower()}.db'")
exec(compile(recorder,str(path),'exec'),{'__file__':str(path),'__name__':'__main__'})
