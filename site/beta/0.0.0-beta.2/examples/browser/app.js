import { execute, describe } from './query.js';
const $ = id => document.getElementById(id);
const controls = [$('run'), $('bad-open'), $('example')];
let evidence;
function choose() {
  const selected = evidence.cases.find(c => c.id === $('example').value);
  $('sql').value = selected.sql;
  $('expected').textContent = JSON.stringify({ sourceId: evidence.sourceId,
    fixtureSHA256: evidence.fixture.sha256, columns: selected.columns, rows: selected.rows }, null, 2);
}
async function run(badOpen = false) {
  controls.forEach(c => c.disabled = true);
  $('status').textContent = 'Running…';
  let local;
  try {
    const sql = $('sql').value;
    // Website adapter: Pages may report compressed wire Content-Length. The
    // fixed, local fixture is decoded before the unchanged engine opens it.
    const response = await fetch(new URL(badOpen ? 'missing.sqlite' : 'chinook.sqlite', import.meta.url), { credentials: 'omit' });
    if (!response.ok) throw new Error(`Database download failed: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    local = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }));
    const result = await execute(local, sql);
    $('actual').textContent = JSON.stringify(result, null, 2);
    const expected = evidence.cases.find(c => c.sql === sql);
    const matches = expected && JSON.stringify(result.rows) === JSON.stringify(expected.rows)
      && JSON.stringify(result.columns.map(c => c.name)) === JSON.stringify(expected.columns);
    $('status').textContent = result.error ? `Error: ${result.error.message}`
      : expected ? matches ? 'PASS: ordered typed rows and column names match native evidence.' : 'FAIL: differs from native evidence.'
      : 'Completed custom SQL (no captured expectation).';
  } catch (error) { $('status').textContent = describe(error); }
  finally { if (local) URL.revokeObjectURL(local); controls.forEach(c => c.disabled = false); }
}
$('run').addEventListener('click', () => run());
$('bad-open').addEventListener('click', () => run(true));
$('example').addEventListener('change', choose);
try {
  const response = await fetch(new URL('expected.json', import.meta.url));
  if (!response.ok) throw new Error(`Expectations HTTP ${response.status}`);
  evidence = await response.json(); choose();
  controls.forEach(c => c.disabled = false);
  $('status').textContent = 'Ready. Run a visible query.';
} catch (error) { $('status').textContent = describe(error); }
