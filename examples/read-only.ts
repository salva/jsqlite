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

let operationError: unknown;
try {
  while ((await statement.step({ timeoutMs: 1_000 })) === "row") {
    // Ordered indexes preserve duplicate names. Returned blobs would be copies.
    console.log(statement.columnInteger(0), statement.columnText(1), statement.column(2));
  }
  statement.reset(); // bindings retained
  statement.clearBindings();
} catch (error) {
  operationError = error;
}

// finalize() destroys even when it reports a saved error. Nest cleanup so close()
// is still attempted. The operation error stays primary, then finalize, then close;
// later cleanup errors are reported as secondary diagnostics.
let finalizeError: unknown;
try {
  statement.finalize();
} catch (error) {
  finalizeError = error;
} finally {
  try {
    db.close();
  } catch (closeError) {
    if (operationError !== undefined || finalizeError !== undefined) {
      console.error("secondary connection-close failure", closeError);
    } else {
      throw closeError;
    }
  }
}

const primaryError = operationError ?? finalizeError;
if (primaryError !== undefined) {
  if (operationError !== undefined && finalizeError !== undefined && finalizeError !== operationError) {
    console.error("secondary statement-finalize failure", finalizeError);
  }
  if (primaryError instanceof JSQLiteError) {
    console.error(primaryError.kind, primaryError.code, primaryError.extendedCode);
  }
  throw primaryError;
}

console.log(prepared.tailOffset, prepared.tail);
