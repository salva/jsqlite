const $ = id => document.getElementById(id);
const examples = {
  albums: `SELECT a.AlbumId, a.Title, t.TrackId,\n       t.Name AS track\nFROM Album AS a JOIN Track AS t\n  ON t.AlbumId = a.AlbumId\nORDER BY a.AlbumId, t.TrackId\nLIMIT 3`,
  artists: 'SELECT ArtistId, Name\nFROM Artist\nORDER BY Name\nLIMIT 20',
  types: "SELECT 42 AS integer_value,\n       3.5 AS real_value,\n       NULL AS null_value,\n       X'CAFE' AS blob_value",
};
let worker, deadline, started;
function setStatus(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function stop() { clearTimeout(deadline); worker?.terminate(); worker = undefined; $('run').disabled = false; $('cancel').disabled = true; }
function render(result) {
  $('results').replaceChildren();
  if (result.error) { setStatus(result.error.message, true); return; }
  const table = document.createElement('table'), head = table.createTHead().insertRow();
  for (const column of result.columns) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = column.name; head.append(th); }
  const body = table.createTBody();
  for (const row of result.rows) {
    const tr = body.insertRow();
    for (const cell of row) { const td = tr.insertCell(); td.title = cell.type; td.textContent = cell.value === null ? 'NULL' : cell.type === 'blob' ? `X'${cell.value}'` : String(cell.value); if (cell.value === null) td.className = 'null'; }
  }
  $('results').append(table);
  setStatus(`${result.rows.length} row${result.rows.length === 1 ? '' : 's'} returned · executed in your browser`);
}
$('example').addEventListener('change', () => { $('sql').value = examples[$('example').value]; });
$('run').addEventListener('click', () => {
  stop(); $('run').disabled = true; $('cancel').disabled = false; $('timing').textContent = ''; setStatus('Fetching database and running query…'); started = performance.now();
  worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => { stop(); $('timing').textContent = `${Math.round(performance.now() - started)} ms total`; render(data); };
  worker.onerror = () => { stop(); setStatus('The query worker failed. Try again or report the query on GitHub.', true); };
  // A UI watchdog terminates the disposable worker; it is not an engine timeout guarantee.
  deadline = setTimeout(() => { stop(); setStatus('Demo stopped this run after 60 seconds. Try a smaller query.', true); }, 60000);
  worker.postMessage({ sql: $('sql').value });
});
$('cancel').addEventListener('click', () => { stop(); setStatus('Cancelled: the disposable query worker was terminated.'); });
$('sql').value = examples.albums; $('run').disabled = false; setStatus('Ready. Choose an example or edit the SQL.');
