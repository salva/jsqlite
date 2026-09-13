import { JSQLiteError, open } from "../src/index.js";
import type {
  ColumnMetadata,
  Connection,
  PrepareResult,
  SqliteStorageClass,
  SqliteValue,
  Statement,
  StepResult,
  UnsupportedClassification,
} from "../src/index.js";

function expectType<T>(_value: T): void {}

const connection = await open("/db.sqlite", {
  timeoutMs: 100,
  limits: { maxFileBytes: 1024, maxWorkUnits: 50 },
});
expectType<Connection>(connection);
// @ts-expect-error Lifecycle is operation-defined; no ambiguous closed boolean.
connection.closed;
const prepared = connection.prepare("select ?1, :name");
expectType<PrepareResult>(prepared);
expectType<number>(prepared.tailOffset);
expectType<string>(prepared.tail);

if (prepared.statement) {
  const statement: Statement = prepared.statement;
  // @ts-expect-error Finalized state is observed through operation misuse errors.
  statement.closed;
  statement.bind(1, 7n);
  statement.bind(":name", "Ada");
  expectType<StepResult>(await statement.step());
  expectType<SqliteValue>(statement.column(0));
  expectType<bigint | null>(statement.columnInteger(0));
  expectType<number | null>(statement.columnReal(0));
  expectType<string | null>(statement.columnText(0));
  expectType<Uint8Array | null>(statement.columnBlob(0));
  expectType<SqliteStorageClass>(statement.columnType(0));
  expectType<ColumnMetadata>(statement.columnMetadata(0));
}

expectType<UnsupportedClassification>("temporary");
expectType<UnsupportedClassification>("permanent");
declare const libraryError: JSQLiteError;
expectType<UnsupportedClassification | null>(libraryError.unsupportedClassification);

// @ts-expect-error INTEGER is bigint, not a potentially lossy number.
prepared.statement?.bind(1, true);
// @ts-expect-error Fetch signal belongs at OpenOptions.signal.
void open("/db.sqlite", { fetchOptions: { signal: new AbortController().signal } });
// @ts-expect-error column indexes are numeric.
prepared.statement?.column("name");
