import { execute } from './assets/query.js';
self.onmessage = async ({ data }) => {
  try { self.postMessage(await execute(new URL('./assets/chinook.sqlite', import.meta.url), data.sql)); }
  catch (error) { self.postMessage({ error: { message: String(error) }, columns: [], rows: [] }); }
};
