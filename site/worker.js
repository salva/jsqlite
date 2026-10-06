import { execute } from './assets/query.js';
self.onmessage = async ({ data }) => {
  let local;
  try {
    // Pages may compress this response: its wire Content-Length is not the
    // decoded SQLite byte count. Open a local Blob URL with exact byte length.
    const response = await fetch(new URL('./assets/chinook.sqlite', import.meta.url), { credentials: 'omit' });
    if (!response.ok) throw new Error(`Database download failed: HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    local = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.sqlite3' }));
    self.postMessage(await execute(local, data.sql));
  }
  catch (error) { self.postMessage({ error: { message: String(error) }, columns: [], rows: [] }); }
  finally { if (local) URL.revokeObjectURL(local); }
};
