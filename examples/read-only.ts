import { JSQLiteError, open } from "../src/index.js";

const controller = new AbortController();
const db = await open(new URL("./catalog.sqlite", import.meta.url), {
  signal: controller.signal,
  timeoutMs: 10_000,
  fetchOptions: { credentials: "omit" },
  limits: { maxFileBytes: 64 * 1024 * 1024, maxRows: 10_000 },
});

const prepared = db.prepare("SELECT id, name, name FROM item WHERE id >= ?1; -- tail");
if (prepared.statement === null) throw new Error("expected a statement");
const statement = prepared.statement;
statement.bind(1, 42n);

try {
  while ((await statement.step({ timeoutMs: 1_000 })) === "row") {
    // Ordered indexes preserve duplicate names. Returned blobs would be copies.
    console.log(statement.columnInteger(0), statement.columnText(1), statement.column(2));
  }
  statement.reset(); // bindings retained
  statement.clearBindings();
} catch (error) {
  if (error instanceof JSQLiteError) {
    console.error(error.kind, error.code, error.extendedCode);
  }
  throw error;
} finally {
  statement.finalize();
  db.close();
}

console.log(prepared.tailOffset, prepared.tail);
