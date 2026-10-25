import { open, JSQLiteError } from '../../dist/index.js';

// Positional cells retain duplicate names and INTEGER/REAL distinctions.
export function cell(statement, index) {
  const type = statement.columnType(index);
  const value = statement.column(index);
  return { type, value: typeof value === 'bigint' ? value.toString()
    : value instanceof Uint8Array ? Array.from(value, b => b.toString(16).padStart(2, '0')).join('') : value };
}
export function describe(error) {
  return error instanceof JSQLiteError
    ? `${error.kind}: ${error.message} (code=${error.code}, extended=${error.extendedCode})`
    : String(error);
}

// Each run owns exactly one connection and at most one statement. Finalize is
// terminal even if it throws the saved step error (vdbeapi.c:sqlite3_finalize).
// Retain operation > finalize > close precedence; always attempt close.
export async function execute(source, sql, options = {}, acquire = open) {
  let db, statement, primary;
  const result = { columns: [], rows: [], events: [], secondary: [], error: null };
  const failure = (stage, error) => {
    if (primary === undefined) { primary = error; result.error = { stage, message: describe(error) }; }
    else if (error !== primary) result.secondary.push({ stage, message: describe(error) });
  };
  try {
    db = await acquire(source, { timeoutMs: 10000, fetchOptions: { credentials: 'omit' },
      limits: { maxFileBytes: 2 * 1024 * 1024, maxRows: 1000 }, ...options });
    result.events.push('opened');
    const prepared = db.prepare(sql);
    statement = prepared.statement;
    if (!statement) throw new Error('Expected a SQL statement');
    if (prepared.tail.trim()) throw new Error('Demo runs one statement at a time');
    result.events.push('prepared');
    result.columns = Array.from({ length: statement.columnCount }, (_, index) => ({ index, ...statement.columnMetadata(index) }));
    while (await statement.step({ timeoutMs: 10000 }) === 'row') {
      result.rows.push(result.columns.map((_, i) => cell(statement, i)));
    }
    result.events.push('done');
  } catch (error) { failure('operation', error); }
  finally {
    if (statement) {
      try { statement.finalize(); result.events.push('finalized'); }
      catch (error) { result.events.push('finalize reported error (handle destroyed)'); failure('finalize', error); }
    }
    if (db) {
      try { db.close(); result.events.push('closed'); }
      catch (error) { result.events.push('close failed'); failure('close', error); }
    } else result.events.push('no connection published; nothing to close');
  }
  return result;
}
